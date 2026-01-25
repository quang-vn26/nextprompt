import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import OpenAI from "openai";
import { Config } from "../config";

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

// Optimized retry configuration - faster retries
const MAX_RETRIES = 2;
const INITIAL_DELAY_MS = 2000; // 2 seconds (reduced from 5s)
const MAX_DELAY_MS = 10000; // 10 seconds (reduced from 60s)

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract retry delay from error response
const getRetryDelay = (error: any, attempt: number): number => {
    // Try to extract "retry after" from error message (e.g., "Please try again in 20s")
    const match = error?.message?.match(/try again in (\d+)s/i);
    if (match) {
        return Math.min(parseInt(match[1]) * 1000, MAX_DELAY_MS);
    }
    // Exponential backoff: 2s, 4s...
    return Math.min(INITIAL_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
};

// Check if error is a rate limit error
const isRateLimitError = (error: any): boolean => {
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
    private openaiModel: string;
    private geminiModel: string;

    constructor(config: Config) {
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        this.geminiModel = config.geminiModel;
        this.openaiModel = config.openaiModel;

        // Using configured gemini model for faster responses
        this.model = config.geminiApiKey
            ? this.genAI.getGenerativeModel({
                model: this.geminiModel,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048, // Limit output for faster response
                }
            })
            : null;

        this.openai = new OpenAI({
            apiKey: config.openaiApiKey,
            dangerouslyAllowBrowser: true,
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
            console.log(`✅ Gemini (${this.geminiModel}) response completed`);
        } catch (geminiError) {
            console.warn("⚠️ Gemini API failed:", geminiError);
            console.log("🔶 Falling back to OpenAI...");
            try {
                await this.streamWithRetry(
                    () => this.streamWithOpenAI(messages, onContent, options),
                    "OpenAI"
                );
                console.log(`✅ OpenAI (${this.openaiModel}) response completed`);
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
        if (!this.model) throw new Error("Gemini model not initialized");

        // Convert history to Gemini format (excluding the last message which is the latest prompt)
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        // Handle system instruction if present
        const systemMsg = messages.find(m => m.role === "system");
        const activeModel = systemMsg
            ? this.genAI.getGenerativeModel({
                model: this.geminiModel,
                systemInstruction: systemMsg.content,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
            : this.model;

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
