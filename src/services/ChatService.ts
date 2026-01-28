import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

// Optimized retry configuration - faster retries
const MAX_RETRIES = 1; // Reduced for faster fallback
const INITIAL_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 5000; // 5 seconds

// ============================================
// Azure AI Model Configurations
// ============================================

// DeepSeek-V3.2-Speciale - FAST (Primary for speed)
const DEEPSEEK_V3_CONFIG = {
    endpoint: import.meta.env.VITE_DEEPSEEK_V3_ENDPOINT || "",
    modelName: "DeepSeek-V3.2-Speciale",
    deploymentName: "DeepSeek-V3.2-Speciale",
    apiKey: import.meta.env.VITE_DEEPSEEK_V3_API_KEY || "",
};

// Phi-4-reasoning - SMART (Fallback 1)
const PHI4_CONFIG = {
    endpoint: import.meta.env.VITE_PHI4_ENDPOINT || "",
    modelName: "Phi-4-reasoning",
    deploymentName: "Phi-4-reasoning",
    apiKey: import.meta.env.VITE_PHI4_API_KEY || "",
};

// DeepSeek-R1 - REASONING (Fallback 2 - for complex tasks)
const DEEPSEEK_R1_CONFIG = {
    endpoint: import.meta.env.VITE_DEEPSEEK_R1_ENDPOINT || "",
    modelName: "DeepSeek-R1-0528",
    deploymentName: "DeepSeek-R1-0528",
    apiKey: import.meta.env.VITE_DEEPSEEK_R1_API_KEY || "",
};

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

// Strip <think>...</think> tags from reasoning models (DeepSeek-R1, etc.)
const stripThinkingTags = (content: string): string => {
    // Remove <think>...</think> blocks (including everything inside)
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Also handle case where </think> hasn't arrived yet (streaming)
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
    // Clean up extra whitespace
    return cleaned.trim();
};

export class ChatService {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private openai: OpenAI;

    // Azure AI clients
    private deepseekV3Client: OpenAI;
    private phi4Client: OpenAI;
    private deepseekR1Client: OpenAI;

    constructor() {
        // DeepSeek-V3.2-Speciale (PRIMARY - FAST)
        this.deepseekV3Client = new OpenAI({
            baseURL: DEEPSEEK_V3_CONFIG.endpoint,
            apiKey: DEEPSEEK_V3_CONFIG.apiKey,
            dangerouslyAllowBrowser: true,
        });

        // Phi-4-reasoning (FALLBACK 1 - SMART)
        this.phi4Client = new OpenAI({
            baseURL: PHI4_CONFIG.endpoint,
            apiKey: PHI4_CONFIG.apiKey,
            dangerouslyAllowBrowser: true,
        });

        // DeepSeek-R1 (FALLBACK 2 - REASONING)
        this.deepseekR1Client = new OpenAI({
            baseURL: DEEPSEEK_R1_CONFIG.endpoint,
            apiKey: DEEPSEEK_R1_CONFIG.apiKey,
            dangerouslyAllowBrowser: true,
        });

        // OpenAI client (FALLBACK 3)
        const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
        this.openai = new OpenAI({
            apiKey: openaiApiKey || "",
            dangerouslyAllowBrowser: true,
        });

        // Gemini client (FALLBACK 4)
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
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

        // Priority order: DeepSeek-V3 (fast) → Phi-4 → DeepSeek-R1 → OpenAI → Gemini
        try {
            console.log("⚡ Using DeepSeek-V3.2-Speciale (FAST)...");
            await this.streamWithRetry(
                () => this.streamWithDeepSeekV3(messages, onContent, options),
                "DeepSeek-V3"
            );
            console.log("✅ DeepSeek-V3.2-Speciale response completed");
            return;
        } catch (deepseekV3Error) {
            console.warn("⚠️ DeepSeek-V3 failed:", deepseekV3Error);
        }

        try {
            console.log("🟣 Falling back to Phi-4-reasoning...");
            await this.streamWithRetry(
                () => this.streamWithPhi4(messages, onContent, options),
                "Phi-4"
            );
            console.log("✅ Phi-4-reasoning response completed");
            return;
        } catch (phi4Error) {
            console.warn("⚠️ Phi-4 failed:", phi4Error);
        }

        try {
            console.log("🧠 Falling back to DeepSeek-R1...");
            await this.streamWithRetry(
                () => this.streamWithDeepSeekR1(messages, onContent, options),
                "DeepSeek-R1"
            );
            console.log("✅ DeepSeek-R1 response completed");
            return;
        } catch (deepseekR1Error) {
            console.warn("⚠️ DeepSeek-R1 failed:", deepseekR1Error);
        }

        try {
            console.log("🔶 Falling back to OpenAI...");
            await this.streamWithRetry(
                () => this.streamWithOpenAI(messages, onContent, options),
                "OpenAI"
            );
            console.log("✅ OpenAI response completed");
            return;
        } catch (openaiError) {
            console.warn("⚠️ OpenAI failed:", openaiError);
        }

        try {
            console.log("🔷 Falling back to Gemini...");
            if (!this.model) {
                throw new Error("Gemini API key not configured");
            }
            await this.streamWithRetry(
                () => this.streamWithGemini(messages, onContent, options),
                "Gemini"
            );
            console.log("✅ Gemini response completed");
        } catch (geminiError) {
            console.error("❌ All APIs failed:", geminiError);
            throw geminiError;
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
                return;
            } catch (error: any) {
                lastError = error;

                if (isRateLimitError(error)) {
                    const retryDelay = getRetryDelay(error, attempt);
                    console.warn(
                        `⏳ ${apiName} rate limit (${attempt + 1}/${MAX_RETRIES}). Retrying in ${Math.round(retryDelay / 1000)}s...`
                    );
                    await delay(retryDelay);
                } else {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    // DeepSeek-V3.2-Speciale streaming (FAST)
    private async streamWithDeepSeekV3(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const formattedMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const stream = await this.deepseekV3Client.chat.completions.create({
            model: DEEPSEEK_V3_CONFIG.deploymentName,
            messages: formattedMessages,
            stream: true,
            temperature: 0.7,
            max_tokens: 4096,
        });

        let accumulatedContent = "";

        for await (const chunk of stream) {
            if (options?.signal?.aborted) {
                throw new Error("Request aborted");
            }
            const delta = chunk.choices[0]?.delta?.content || "";
            accumulatedContent += delta;
            // Strip thinking tags from reasoning models
            const cleanContent = stripThinkingTags(accumulatedContent);
            if (cleanContent) {
                onContent(cleanContent, false);
            }
        }

        onContent(stripThinkingTags(accumulatedContent), true);
    }

    // Phi-4-reasoning streaming
    private async streamWithPhi4(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const formattedMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const stream = await this.phi4Client.chat.completions.create({
            model: PHI4_CONFIG.deploymentName,
            messages: formattedMessages,
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
            // Strip thinking tags from reasoning models
            const cleanContent = stripThinkingTags(accumulatedContent);
            if (cleanContent) {
                onContent(cleanContent, false);
            }
        }

        onContent(stripThinkingTags(accumulatedContent), true);
    }

    // DeepSeek-R1 streaming (REASONING)
    private async streamWithDeepSeekR1(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const formattedMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const stream = await this.deepseekR1Client.chat.completions.create({
            model: DEEPSEEK_R1_CONFIG.deploymentName,
            messages: formattedMessages,
            stream: true,
            temperature: 0.6, // Lower temp for reasoning
            max_tokens: 4096,
        });

        let accumulatedContent = "";

        for await (const chunk of stream) {
            if (options?.signal?.aborted) {
                throw new Error("Request aborted");
            }
            const delta = chunk.choices[0]?.delta?.content || "";
            accumulatedContent += delta;
            // Strip thinking tags from reasoning models
            const cleanContent = stripThinkingTags(accumulatedContent);
            if (cleanContent) {
                onContent(cleanContent, false);
            }
        }

        onContent(stripThinkingTags(accumulatedContent), true);
    }

    // Gemini streaming
    private async streamWithGemini(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        _options?: { signal?: AbortSignal },
    ): Promise<void> {
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

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

    // OpenAI streaming
    private async streamWithOpenAI(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const openaiMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const stream = await this.openai.chat.completions.create({
            model: "gpt-4.1-mini",
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

    // Non-streaming method
    async sendMessage(messages: ChatMessage[]): Promise<string> {
        const formattedMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        // Try DeepSeek-V3 first (FAST)
        try {
            console.log("⚡ Using DeepSeek-V3.2-Speciale for sendMessage...");
            const response = await this.deepseekV3Client.chat.completions.create({
                model: DEEPSEEK_V3_CONFIG.deploymentName,
                messages: formattedMessages,
                temperature: 0.7,
                max_tokens: 4096,
            });
            return response.choices[0]?.message?.content || "";
        } catch (error) {
            console.warn("DeepSeek-V3 sendMessage failed:", error);
        }

        // Fallback to Phi-4
        try {
            console.log("🟣 Using Phi-4 for sendMessage...");
            const response = await this.phi4Client.chat.completions.create({
                model: PHI4_CONFIG.deploymentName,
                messages: formattedMessages,
                temperature: 0.7,
                max_tokens: 2048,
            });
            return response.choices[0]?.message?.content || "";
        } catch (error) {
            console.warn("Phi-4 sendMessage failed:", error);
        }

        // Fallback to OpenAI
        try {
            console.log("🔶 Using OpenAI for sendMessage...");
            const response = await this.openai.chat.completions.create({
                model: "gpt-4.1-mini",
                messages: formattedMessages,
                temperature: 0.7,
                max_tokens: 2048,
            });
            return response.choices[0]?.message?.content || "";
        } catch (error) {
            console.warn("OpenAI sendMessage failed:", error);
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
        } catch (error) {
            console.error("All APIs failed for sendMessage:", error);
            throw error;
        }
    }
}
