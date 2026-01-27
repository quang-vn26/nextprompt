import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import OpenAI from "openai";
import { CONFIG } from "../config";

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

interface RequestError {
    message?: string;
    status?: number;
    response?: {
        status: number;
    };
}

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract retry delay from error response
const getRetryDelay = (error: RequestError, attempt: number): number => {
    // Try to extract "retry after" from error message (e.g., "Please try again in 20s")
    const match = error?.message?.match(/try again in (\d+)s/i);
    if (match) {
        return Math.min(parseInt(match[1]) * 1000, CONFIG.RETRY.MAX_DELAY_MS);
    }
    // Exponential backoff: 2s, 4s...
    return Math.min(CONFIG.RETRY.INITIAL_DELAY_MS * Math.pow(2, attempt), CONFIG.RETRY.MAX_DELAY_MS);
};

// Check if error is a rate limit error
const isRateLimitError = (error: RequestError): boolean => {
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
    private openaiModel: string = CONFIG.OPENAI_MODEL;

    constructor() {
        // SECURITY WARNING: API keys are exposed in client-side code.
        // This is not recommended for production. Use a backend proxy instead.
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

        if (!geminiApiKey) {
            console.warn(
                "Gemini API key not found. Will use OpenAI as primary.",
            );
        }

        this.genAI = new GoogleGenerativeAI(geminiApiKey || "");
        // Using gemini-2.0-flash for faster responses
        this.model = geminiApiKey
            ? this.genAI.getGenerativeModel({
                model: CONFIG.GEMINI_MODEL,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048, // Limit output for faster response
                }
            })
            : null;

        // OpenAI fallback client
        const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!openaiApiKey) {
            console.warn("OpenAI API key not found. Fallback will not work.");
        }
        this.openai = new OpenAI({
            apiKey: openaiApiKey || "",
            dangerouslyAllowBrowser: true, // SECURITY WARNING: Allows client-side usage of API key
        });
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.log("📨 Chat request");

        // Try Gemini first with retry, fallback to OpenAI on error
        try {
            if (!this.model) {
                throw new Error("Gemini API key not configured");
            }
            console.log("🔷 Using Gemini API...");
            await this.streamWithRetry(
                () => this.streamWithGemini(messages, onContent, options),
                "Gemini"
            );
            console.log(`✅ Gemini (${CONFIG.GEMINI_MODEL}) response completed`);
        } catch (geminiError) {
            console.warn("⚠️ Gemini API failed:", geminiError);
            console.log("🔶 Falling back to OpenAI...");
            try {
                await this.streamWithRetry(
                    () => this.streamWithOpenAI(messages, onContent, options),
                    "OpenAI"
                );
                console.log(`✅ OpenAI (${CONFIG.OPENAI_MODEL}) response completed`);
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
        let lastError: unknown;

        for (let attempt = 0; attempt < CONFIG.RETRY.MAX_RETRIES; attempt++) {
            try {
                await fn();
                return; // Success, exit
            } catch (error: unknown) {
                lastError = error;
                // Cast to RequestError for checking
                const requestError = error as RequestError;

                if (isRateLimitError(requestError)) {
                    const retryDelay = getRetryDelay(requestError, attempt);
                    console.warn(
                        `⏳ ${apiName} rate limit (${attempt + 1}/${CONFIG.RETRY.MAX_RETRIES}). Retrying in ${Math.round(retryDelay / 1000)}s...`
                    );
                    await delay(retryDelay);
                } else {
                    // Not a rate limit error, don't retry
                    throw error;
                }
            }
        }

        // All retries exhausted
        console.error(`❌ ${apiName}: All ${CONFIG.RETRY.MAX_RETRIES} retry attempts failed`);
        throw lastError;
    }

    private async streamWithGemini(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        _options?: { signal?: AbortSignal },
    ): Promise<void> {
        // Convert history to Gemini format (excluding the last message which is the latest prompt)
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        // Handle system instruction if present
        const systemMsg = messages.find(m => m.role === "system");
        const activeModel = systemMsg
            ? this.genAI.getGenerativeModel({
                model: CONFIG.GEMINI_MODEL,
                systemInstruction: systemMsg.content,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
            : this.model;

        // Check if activeModel is null before using (it shouldn't be if this method is called after model check)
        if (!activeModel) {
             throw new Error("Gemini model not initialized");
        }

        const chat = activeModel.startChat({
            history: history.filter(h => h.role !== "system"),
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
            temperature: 0.7,
            max_tokens: 2048,
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
                temperature: 0.7,
                max_tokens: 2048,
            });
            return response.choices[0]?.message?.content || "";
        }
    }
}
