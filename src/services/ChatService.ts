import { ChatMessage, LLMProvider } from "./llm/types";
import { GeminiProvider } from "./llm/GeminiProvider";
import { OpenAIProvider } from "./llm/OpenAIProvider";

// Optimized retry configuration - faster retries
const MAX_RETRIES = 2;
const INITIAL_DELAY_MS = 2000;
const MAX_DELAY_MS = 10000;

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract retry delay from error response
const getRetryDelay = (error: any, attempt: number): number => {
    const match = error?.message?.match(/try again in (\d+)s/i);
    if (match) {
        return Math.min(parseInt(match[1]) * 1000, MAX_DELAY_MS);
    }
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
    private geminiProvider: GeminiProvider | null = null;
    private openaiProvider: OpenAIProvider | null = null;

    constructor() {
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

        if (geminiApiKey) {
            this.geminiProvider = new GeminiProvider(geminiApiKey);
        } else {
            console.warn("Gemini API key not found. Will use OpenAI as primary.");
        }

        if (openaiApiKey) {
            this.openaiProvider = new OpenAIProvider(openaiApiKey);
        } else {
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
            if (!this.geminiProvider) {
                throw new Error("Gemini API key not configured");
            }
            console.log("🔷 Using Gemini API...");
            await this.streamWithRetry(
                (provider) => provider.streamChat(messages, onContent, options),
                this.geminiProvider,
            );
            console.log("✅ Gemini response completed");
        } catch (geminiError) {
            console.warn("⚠️ Gemini API failed:", geminiError);
            console.log("🔶 Falling back to OpenAI...");
            try {
                if (!this.openaiProvider) {
                    throw new Error("OpenAI API key not configured");
                }
                await this.streamWithRetry(
                    (provider) => provider.streamChat(messages, onContent, options),
                    this.openaiProvider,
                );
                console.log("✅ OpenAI response completed");
            } catch (openaiError) {
                console.error("❌ OpenAI also failed:", openaiError);
                throw openaiError;
            }
        }
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        try {
            if (!this.geminiProvider) {
                throw new Error("Gemini API key not configured");
            }
             // Since we don't have a retry wrapper for non-void returns in this simplified version,
             // we'll just call directly or implement a simple try-catch fallback similar to original code.
             // But let's use the retry logic adapted for returning values if we want consistency,
             // but strictly sticking to original behavior of "try gemini, catch, try openai" is enough.

            return await this.geminiProvider.sendMessage(messages);
        } catch (error) {
            console.warn("Gemini sendMessage failed, trying OpenAI:", error);
            if (!this.openaiProvider) {
                throw new Error("OpenAI API key not configured");
            }
            return await this.openaiProvider.sendMessage(messages);
        }
    }

    private async streamWithRetry(
        fn: (provider: LLMProvider) => Promise<void>,
        provider: LLMProvider
    ): Promise<void> {
        let lastError: any;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                await fn(provider);
                return; // Success, exit
            } catch (error: any) {
                lastError = error;

                if (isRateLimitError(error)) {
                    const retryDelay = getRetryDelay(error, attempt);
                    console.warn(
                        `⏳ ${provider.name} rate limit (${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(retryDelay / 1000)}s...`
                    );
                    await delay(retryDelay);
                } else {
                    // Not a rate limit error, don't retry
                    throw error;
                }
            }
        }

        // All retries exhausted
        console.error(`❌ ${provider.name}: All ${MAX_RETRIES} retry attempts failed`);
        throw lastError;
    }
}
