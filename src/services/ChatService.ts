import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

// Optimized retry configuration - faster retries
const MAX_RETRIES = 2;
const INITIAL_DELAY_MS = 2000; // 2 seconds (reduced from 5s)
const MAX_DELAY_MS = 10000; // 10 seconds (reduced from 60s)

// Phi-4 Azure AI Configuration - Read from environment variables
const PHI4_CONFIG = {
    endpoint: import.meta.env.VITE_PHI4_ENDPOINT || "",
    modelName: "Phi-4-reasoning",
    deploymentName: "Phi-4-reasoning",
    apiKey: import.meta.env.VITE_PHI4_API_KEY || "",
};

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
    private model: any;
    private openai: OpenAI;
    private phi4Client: OpenAI;
    private openaiModel: string = "gpt-4.1-mini";

    constructor() {
        // Phi-4 Azure AI client (PRIMARY)
        this.phi4Client = new OpenAI({
            baseURL: PHI4_CONFIG.endpoint,
            apiKey: PHI4_CONFIG.apiKey,
            dangerouslyAllowBrowser: true,
        });

        // OpenAI client (FALLBACK 1)
        const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!openaiApiKey) {
            console.warn("OpenAI API key not found. Fallback 1 will not work.");
        }
        this.openai = new OpenAI({
            apiKey: openaiApiKey || "",
            dangerouslyAllowBrowser: true,
        });

        // Gemini client (FALLBACK 2)
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!geminiApiKey) {
            console.warn("Gemini API key not found. Fallback 2 will not work.");
        }
        this.genAI = new GoogleGenerativeAI(geminiApiKey || "");
        this.model = geminiApiKey
            ? this.genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
            : null;
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.log("📨 Chat request");

        // Priority order: Phi-4 → OpenAI → Gemini
        try {
            console.log("🟣 Using Phi-4 (Azure AI)...");
            await this.streamWithRetry(
                () => this.streamWithPhi4(messages, onContent, options),
                "Phi-4"
            );
            console.log("✅ Phi-4 (Phi-4-reasoning) response completed");
        } catch (phi4Error) {
            console.warn("⚠️ Phi-4 API failed:", phi4Error);
            console.log("� Falling back to OpenAI...");
            try {
                await this.streamWithRetry(
                    () => this.streamWithOpenAI(messages, onContent, options),
                    "OpenAI"
                );
                console.log("✅ OpenAI (gpt-4.1-mini) response completed");
            } catch (openaiError) {
                console.warn("⚠️ OpenAI API failed:", openaiError);
                console.log("� Falling back to Gemini...");
                try {
                    if (!this.model) {
                        throw new Error("Gemini API key not configured");
                    }
                    await this.streamWithRetry(
                        () => this.streamWithGemini(messages, onContent, options),
                        "Gemini"
                    );
                    console.log("✅ Gemini (gemini-2.5-flash) response completed");
                } catch (geminiError) {
                    console.error("❌ All APIs failed:", geminiError);
                    throw geminiError;
                }
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

    private async streamWithPhi4(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        // Convert messages to OpenAI format
        const phi4Messages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const stream = await this.phi4Client.chat.completions.create({
            model: PHI4_CONFIG.deploymentName,
            messages: phi4Messages,
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
                model: "gemini-2.5-flash",
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
        const phi4Messages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        // Try Phi-4 first
        try {
            console.log("🟣 Using Phi-4 for sendMessage...");
            const response = await this.phi4Client.chat.completions.create({
                model: PHI4_CONFIG.deploymentName,
                messages: phi4Messages,
                temperature: 0.7,
                max_tokens: 2048,
            });
            return response.choices[0]?.message?.content || "";
        } catch (phi4Error) {
            console.warn("Phi-4 sendMessage failed, trying OpenAI:", phi4Error);
        }

        // Fallback to OpenAI
        try {
            console.log("🔶 Using OpenAI for sendMessage...");
            const response = await this.openai.chat.completions.create({
                model: this.openaiModel,
                messages: phi4Messages,
                temperature: 0.7,
                max_tokens: 2048,
            });
            return response.choices[0]?.message?.content || "";
        } catch (openaiError) {
            console.warn("OpenAI sendMessage failed, trying Gemini:", openaiError);
        }

        // Fallback to Gemini
        try {
            if (!this.model) {
                throw new Error("Gemini API key not configured");
            }
            console.log("🔷 Using Gemini for sendMessage...");
            const lastMessage = messages[messages.length - 1].content;
            const result = await this.model.generateContent(lastMessage);
            const response = await result.response;
            return response.text();
        } catch (geminiError) {
            console.error("All APIs failed for sendMessage:", geminiError);
            throw geminiError;
        }
    }
}
