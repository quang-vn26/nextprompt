import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import OpenAI from "openai";

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

interface ApiError {
    message?: string;
    status?: number;
    response?: {
        status?: number;
    };
}

// Configuration Constants
const GEMINI_MODEL = "gemini-2.5-flash";
const OPENAI_MODEL = "gpt-4.1-mini";
const MAX_OUTPUT_TOKENS = 2048;
const TEMPERATURE = 0.7;

// Optimized retry configuration - faster retries
const MAX_RETRIES = 2;
const INITIAL_DELAY_MS = 2000; // 2 seconds
const MAX_DELAY_MS = 10000; // 10 seconds

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract retry delay from error response
const getRetryDelay = (error: ApiError, attempt: number): number => {
    // Try to extract "retry after" from error message (e.g., "Please try again in 20s")
    const match = error?.message?.match(/try again in (\d+)s/i);
    if (match) {
        return Math.min(parseInt(match[1]) * 1000, MAX_DELAY_MS);
    }
    // Exponential backoff: 2s, 4s...
    return Math.min(INITIAL_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
};

// Check if error is a rate limit error
const isRateLimitError = (error: ApiError): boolean => {
    const message = error?.message?.toLowerCase() || "";
    const status = error?.status || error?.response?.status;
    return status === 429 ||
        message.includes("rate limit") ||
        message.includes("quota") ||
        message.includes("too many requests") ||
        message.includes("resource exhausted");
};

export class ChatService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel | null;
    private openai: OpenAI;
    private openaiModel: string = OPENAI_MODEL;

    constructor() {
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

        // SECURITY WARNING: API keys are exposed in the client-side code.
        // This is not recommended for production environments.
        // Ideally, these calls should be proxied through a backend service.
        if (!geminiApiKey) {
            console.warn(
                "Gemini API key not found. Will use OpenAI as primary.",
            );
        }

        this.genAI = new GoogleGenerativeAI(geminiApiKey || "");

        this.model = geminiApiKey
            ? this.genAI.getGenerativeModel({
                model: GEMINI_MODEL,
                generationConfig: {
                    temperature: TEMPERATURE,
                    maxOutputTokens: MAX_OUTPUT_TOKENS,
                }
            })
            : null;

        // OpenAI fallback client
        const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!openaiApiKey) {
            console.warn("OpenAI API key not found. Fallback will not work.");
        }

        // SECURITY WARNING: dangerouslyAllowBrowser: true explicitly allows client-side usage of the key.
        this.openai = new OpenAI({
            apiKey: openaiApiKey || "",
            dangerouslyAllowBrowser: true,
        });
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.debug("📨 Chat request");

        // Try Gemini first with retry, fallback to OpenAI on error
        try {
            if (!this.model) {
                throw new Error("Gemini API key not configured");
            }
            console.debug("🔷 Using Gemini API...");
            await this.streamWithRetry(
                () => this.streamWithGemini(messages, onContent, options),
                "Gemini"
            );
            console.debug(`✅ Gemini (${GEMINI_MODEL}) response completed`);
        } catch (geminiError) {
            console.warn("⚠️ Gemini API failed:", geminiError);
            console.debug("🔶 Falling back to OpenAI...");
            try {
                await this.streamWithRetry(
                    () => this.streamWithOpenAI(messages, onContent, options),
                    "OpenAI"
                );
                console.debug(`✅ OpenAI (${OPENAI_MODEL}) response completed`);
            } catch (openaiError) {
                console.error("❌ OpenAI also failed:", openaiError);
                throw openaiError;
            }
        }
    }

    private async streamWithRetry(
        fn: () => Promise<void>,
        apiName: string
    ): Promise<void> {
        let lastError: any;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                await fn();
                return; // Success, exit
            } catch (error: any) {
                lastError = error;

                if (isRateLimitError(error)) {
                    const retryDelay = getRetryDelay(error, attempt);
                    console.warn(
                        `⏳ ${apiName} rate limit (${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(retryDelay / 1000)}s...`
                    );
                    await delay(retryDelay);
                } else {
                    // Not a rate limit error, don't retry
                    throw error;
                }
            }
        }

        // All retries exhausted
        console.error(`❌ ${apiName}: All ${MAX_RETRIES} retry attempts failed`);
        throw lastError;
    }

    private async streamWithGemini(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        _options?: { signal?: AbortSignal },
    ): Promise<void> {
        // Convert history to Gemini format (excluding the last message which is the latest prompt)
        // Also exclude system messages from the history array as they are handled via systemInstruction
        const history = messages
            .slice(0, -1)
            .filter(msg => msg.role !== "system")
            .map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            }));

        // Handle system instruction if present
        const systemMsg = messages.find(m => m.role === "system");
        const activeModel = systemMsg
            ? this.genAI.getGenerativeModel({
                model: GEMINI_MODEL,
                systemInstruction: systemMsg.content,
                generationConfig: {
                    temperature: TEMPERATURE,
                    maxOutputTokens: MAX_OUTPUT_TOKENS,
                }
            })
            : this.model;

        if (!activeModel) {
             throw new Error("Gemini model not initialized");
        }

        const chat = activeModel.startChat({
            history: history,
        });

        const lastMessage = messages[messages.length - 1].content;
        const result = await chat.sendMessageStream(lastMessage);

        let accumulatedContent = "";

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            accumulatedContent += chunkText;
            onContent(accumulatedContent, false);
        }

        onContent(accumulatedContent, true);
    }

    private async streamWithOpenAI(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        // Convert messages to OpenAI format
        const openaiMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const stream = await this.openai.chat.completions.create({
            model: this.openaiModel,
            messages: openaiMessages,
            stream: true,
            temperature: TEMPERATURE,
            max_tokens: MAX_OUTPUT_TOKENS,
        });

        let accumulatedContent = "";

        for await (const chunk of stream) {
            if (options?.signal?.aborted) {
                throw new Error("Request aborted");
            }
            const delta = chunk.choices[0]?.delta?.content || "";
            accumulatedContent += delta;
            onContent(accumulatedContent, false);
        }

        onContent(accumulatedContent, true);
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        try {
            if (!this.model) {
                throw new Error("Gemini API key not configured");
            }
            const lastMessage = messages[messages.length - 1].content;
            const result = await this.model.generateContent(lastMessage);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.warn("Gemini sendMessage failed, trying OpenAI:", error);
            // Fallback to OpenAI
            const openaiMessages = messages.map(msg => ({
                role: msg.role as "user" | "assistant" | "system",
                content: msg.content,
            }));
            const response = await this.openai.chat.completions.create({
                model: this.openaiModel,
                messages: openaiMessages,
                temperature: TEMPERATURE,
                max_tokens: MAX_OUTPUT_TOKENS,
            });
            return response.choices[0]?.message?.content || "";
        }
    }
}
