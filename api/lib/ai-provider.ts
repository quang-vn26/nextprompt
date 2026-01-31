/**
 * AI Provider Module
 * Unified interface for multiple AI providers with fallback strategy
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage, ChatRequest, ChatResponse, StreamChunk, ChatMode } from './types';
import { logUsage } from './mongodb';

// ============================================
// Configuration
// ============================================

interface ProviderConfig {
    endpoint: string;
    apiKey: string;
    deployment: string;
}

// DeepSeek-V3.2-Speciale - FAST (Primary for speed)
const DEEPSEEK_V3_CONFIG: ProviderConfig = {
    endpoint: process.env.DEEPSEEK_V3_ENDPOINT || "",
    apiKey: process.env.DEEPSEEK_V3_API_KEY || "",
    deployment: "DeepSeek-V3.2-Speciale",
};

// Phi-4-reasoning - SMART (Fallback 1)
const PHI4_CONFIG: ProviderConfig = {
    endpoint: process.env.AZURE_PHI4_ENDPOINT || process.env.VITE_PHI4_ENDPOINT || "",
    apiKey: process.env.AZURE_PHI4_API_KEY || process.env.VITE_PHI4_API_KEY || "",
    deployment: "Phi-4-reasoning",
};

// DeepSeek-R1 - REASONING (Fallback 2 - for complex tasks)
const DEEPSEEK_R1_CONFIG: ProviderConfig = {
    endpoint: process.env.DEEPSEEK_R1_ENDPOINT || "",
    apiKey: process.env.DEEPSEEK_R1_API_KEY || "",
    deployment: "DeepSeek-R1-0528",
};

// OpenAI (Fallback 3)
const OPENAI_CONFIG = {
    apiKey: process.env.OPENAI_API_KEY || "",
};

// Gemini (Fallback 4)
const GEMINI_CONFIG = {
    apiKey: process.env.GEMINI_API_KEY || "",
};

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract retry delay from error response
const getRetryDelay = (error: any, attempt: number): number => {
    const match = error?.message?.match(/try again in (\d+)s/i);
    const MAX_DELAY_MS = 5000;
    const INITIAL_DELAY_MS = 1000;

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

// Strip <think>...</think> tags from reasoning models
const stripThinkingTags = (content: string): string => {
    // Remove <think>...</think> blocks (including everything inside)
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Also handle case where </think> hasn't arrived yet (streaming)
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
    // Clean up extra whitespace
    return cleaned.trim();
};

// ============================================
// AI Provider Class
// ============================================

export class AIProvider {
    private deepseekV3Client: OpenAI | null = null;
    private phi4Client: OpenAI | null = null;
    private deepseekR1Client: OpenAI | null = null;
    private openaiClient: OpenAI | null = null;
    private geminiClient: GoogleGenerativeAI | null = null;
    private geminiModel: any = null;

    private sessionId: string;
    private readonly MAX_RETRIES = 1;

    constructor(sessionId: string = 'default') {
        this.sessionId = sessionId;
        this.initializeClients();
    }

    /**
     * Initialize clients
     */
    private initializeClients(): void {
        // DeepSeek V3
        if (DEEPSEEK_V3_CONFIG.apiKey) {
            this.deepseekV3Client = new OpenAI({
                baseURL: DEEPSEEK_V3_CONFIG.endpoint,
                apiKey: DEEPSEEK_V3_CONFIG.apiKey,
            });
        }

        // Phi-4
        if (PHI4_CONFIG.apiKey) {
            this.phi4Client = new OpenAI({
                baseURL: PHI4_CONFIG.endpoint,
                apiKey: PHI4_CONFIG.apiKey,
            });
        }

        // DeepSeek R1
        if (DEEPSEEK_R1_CONFIG.apiKey) {
            this.deepseekR1Client = new OpenAI({
                baseURL: DEEPSEEK_R1_CONFIG.endpoint,
                apiKey: DEEPSEEK_R1_CONFIG.apiKey,
            });
        }

        // OpenAI
        if (OPENAI_CONFIG.apiKey) {
            this.openaiClient = new OpenAI({
                apiKey: OPENAI_CONFIG.apiKey,
            });
        }

        // Gemini
        if (GEMINI_CONFIG.apiKey) {
            this.geminiClient = new GoogleGenerativeAI(GEMINI_CONFIG.apiKey);
            this.geminiModel = this.geminiClient.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            });
        }
    }

    /**
     * Check if provider is ready
     */
    isReady(): boolean {
        return !!(this.deepseekV3Client || this.phi4Client || this.deepseekR1Client || this.openaiClient || this.geminiClient);
    }

    /**
     * Helper to execute with retries
     */
    private async executeWithRetry<T>(
        fn: () => Promise<T>,
        apiName: string
    ): Promise<T> {
        let lastError: any;

        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;

                if (isRateLimitError(error) && attempt < this.MAX_RETRIES) {
                    const retryDelay = getRetryDelay(error, attempt);
                    console.warn(
                        `⏳ ${apiName} rate limit (${attempt + 1}/${this.MAX_RETRIES}). Retrying in ${Math.round(retryDelay / 1000)}s...`
                    );
                    await delay(retryDelay);
                } else {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    /**
     * Stream chat completion with fallback
     */
    async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
        // Priority order: DeepSeek-V3 (fast) → Phi-4 → DeepSeek-R1 → OpenAI → Gemini

        let success = false;

        // 1. DeepSeek-V3
        if (this.deepseekV3Client) {
            try {
                console.log("⚡ Using DeepSeek-V3.2-Speciale (FAST)...");
                const stream = await this.executeWithRetry(
                    () => this.createOpenAIStream(this.deepseekV3Client!, DEEPSEEK_V3_CONFIG.deployment, request, 4096),
                    "DeepSeek-V3"
                );

                for await (const chunk of this.processOpenAIStream(stream)) {
                    yield chunk;
                }
                success = true;
                return;
            } catch (error) {
                console.warn("⚠️ DeepSeek-V3 failed:", error);
            }
        }

        // 2. Phi-4
        if (!success && this.phi4Client) {
            try {
                console.log("🟣 Falling back to Phi-4-reasoning...");
                const stream = await this.executeWithRetry(
                    () => this.createOpenAIStream(this.phi4Client!, PHI4_CONFIG.deployment, request, 2048),
                    "Phi-4"
                );

                for await (const chunk of this.processOpenAIStream(stream)) {
                    yield chunk;
                }
                success = true;
                return;
            } catch (error) {
                console.warn("⚠️ Phi-4 failed:", error);
            }
        }

        // 3. DeepSeek-R1
        if (!success && this.deepseekR1Client) {
            try {
                console.log("🧠 Falling back to DeepSeek-R1...");
                const stream = await this.executeWithRetry(
                    () => this.createOpenAIStream(this.deepseekR1Client!, DEEPSEEK_R1_CONFIG.deployment, request, 4096, 0.6),
                    "DeepSeek-R1"
                );

                for await (const chunk of this.processOpenAIStream(stream)) {
                    yield chunk;
                }
                success = true;
                return;
            } catch (error) {
                console.warn("⚠️ DeepSeek-R1 failed:", error);
            }
        }

        // 4. OpenAI
        if (!success && this.openaiClient) {
            try {
                console.log("🔶 Falling back to OpenAI...");
                const stream = await this.executeWithRetry(
                    () => this.createOpenAIStream(this.openaiClient!, "gpt-4.1-mini", request, 2048),
                    "OpenAI"
                );

                for await (const chunk of this.processOpenAIStream(stream)) {
                    yield chunk;
                }
                success = true;
                return;
            } catch (error) {
                console.warn("⚠️ OpenAI failed:", error);
            }
        }

        // 5. Gemini
        if (!success && this.geminiModel) {
            try {
                console.log("🔷 Falling back to Gemini...");
                // Gemini stream is different, we can't easily separate create/process in the same way
                // without changing return type, but we can wrap the creation.
                const result = await this.executeWithRetry(
                    () => this.createGeminiStream(request),
                    "Gemini"
                );

                for await (const chunk of this.processGeminiStream(result)) {
                    yield chunk;
                }
                success = true;
                return;
            } catch (error) {
                console.error("❌ All APIs failed:", error);
                throw error;
            }
        }

        if (!success) {
            throw new Error("No AI providers available or all failed.");
        }
    }

    private async createOpenAIStream(
        client: OpenAI,
        model: string,
        request: ChatRequest,
        maxTokens: number,
        temperature: number = 0.7
    ) {
        return await client.chat.completions.create({
            model: model,
            messages: request.messages.map(msg => ({
                role: msg.role as any,
                content: msg.content,
            })),
            stream: true,
            temperature: request.temperature ?? temperature,
            max_tokens: request.maxTokens ?? maxTokens,
        });
    }

    private async *processOpenAIStream(stream: any): AsyncGenerator<StreamChunk> {
        let accumulatedContent = "";

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            accumulatedContent += delta;

            yield {
                content: stripThinkingTags(accumulatedContent),
                done: false,
            };
        }

        yield {
            content: stripThinkingTags(accumulatedContent),
            done: true,
        };
    }

    private async createGeminiStream(request: ChatRequest) {
        const history = request.messages.slice(0, -1).map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        const systemMsg = request.messages.find(m => m.role === "system");

        let model = this.geminiModel;
        if (systemMsg) {
             model = this.geminiClient!.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: systemMsg.content,
                generationConfig: {
                    temperature: request.temperature ?? 0.7,
                    maxOutputTokens: request.maxTokens ?? 2048,
                }
            });
        }

        const chat = model.startChat({
            history: history.filter(h => h.role !== "system"),
        });

        const lastMessage = request.messages[request.messages.length - 1].content;
        // This is the call we want to retry if it fails initially
        return await chat.sendMessageStream(lastMessage);
    }

    private async *processGeminiStream(result: any): AsyncGenerator<StreamChunk> {
        let accumulatedContent = "";

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            accumulatedContent += chunkText;

            yield {
                content: accumulatedContent,
                done: false,
            };
        }

        yield {
            content: accumulatedContent,
            done: true,
        };
    }

    /**
     * Chat completion (non-streaming) with fallback
     */
    async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
        const stream = this.streamChat(request);
        let finalContent = "";

        for await (const chunk of stream) {
            finalContent = chunk.content;
            if (chunk.done) break;
        }

        return {
            content: finalContent,
            model: "auto-fallback",
            usage: undefined
        };
    }
}

// ============================================
// Singleton instance for API routes
// ============================================

let providerInstance: AIProvider | null = null;

export function getAIProvider(sessionId?: string): AIProvider {
    if (!providerInstance) {
        providerInstance = new AIProvider(sessionId);
    }
    return providerInstance;
}
