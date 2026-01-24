import { config } from "../config";
import { ChatMessage, IChatProvider } from "./llm/types";
import { GeminiProvider } from "./llm/GeminiProvider";
import { OpenAIProvider } from "./llm/OpenAIProvider";

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract retry delay from error response
const getRetryDelay = (error: any, attempt: number): number => {
    // Try to extract "retry after" from error message (e.g., "Please try again in 20s")
    const match = error?.message?.match(/try again in (\d+)s/i);
    if (match) {
        return Math.min(parseInt(match[1]) * 1000, config.retry.maxDelayMs);
    }
    // Exponential backoff
    return Math.min(config.retry.initialDelayMs * Math.pow(2, attempt), config.retry.maxDelayMs);
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
    private geminiProvider: GeminiProvider;
    private openaiProvider: OpenAIProvider;

    constructor() {
        this.geminiProvider = new GeminiProvider();
        this.openaiProvider = new OpenAIProvider();

        if (!config.gemini.apiKey) {
            console.warn(
                "Gemini API key not found. Will use OpenAI as primary.",
            );
        }
        if (!config.openai.apiKey) {
            console.warn("OpenAI API key not found. Fallback will not work.");
        }
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.log("📨 Chat request");

        // Try Gemini first with retry, fallback to OpenAI on error
        try {
            if (!config.gemini.apiKey) {
                throw new Error("Gemini API key not configured");
            }
            console.log("🔷 Using Gemini API...");
            await this.executeWithRetry(
                this.geminiProvider,
                messages,
                onContent,
                options
            );
            console.log("✅ Gemini response completed");
        } catch (geminiError) {
            console.warn("⚠️ Gemini API failed:", geminiError);
            console.log("🔶 Falling back to OpenAI...");
            try {
                await this.executeWithRetry(
                    this.openaiProvider,
                    messages,
                    onContent,
                    options
                );
                console.log("✅ OpenAI response completed");
            } catch (openaiError) {
                console.error("❌ OpenAI also failed:", openaiError);
                throw openaiError;
            }
        }
    }

    private async executeWithRetry(
        provider: IChatProvider,
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal }
    ): Promise<void> {
        let lastError: any;

        for (let attempt = 0; attempt < config.retry.maxRetries; attempt++) {
            try {
                await provider.streamChat(messages, onContent, options);
                return; // Success, exit
            } catch (error: any) {
                lastError = error;

                if (isRateLimitError(error)) {
                    const retryDelay = getRetryDelay(error, attempt);
                    console.warn(
                        `⏳ ${provider.name} rate limit (${attempt + 1}/${config.retry.maxRetries}). Retrying in ${Math.round(retryDelay / 1000)}s...`
                    );
                    await delay(retryDelay);
                } else {
                    // Not a rate limit error, don't retry
                    throw error;
                }
            }
        }

        // All retries exhausted
        console.error(`❌ ${provider.name}: All ${config.retry.maxRetries} retry attempts failed`);
        throw lastError;
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        try {
            if (!config.gemini.apiKey) {
                throw new Error("Gemini API key not configured");
            }
            return await this.geminiProvider.sendMessage(messages);
        } catch (error) {
            console.warn("Gemini sendMessage failed, trying OpenAI:", error);
            // Fallback to OpenAI
            return await this.openaiProvider.sendMessage(messages);
        }
    }
}
