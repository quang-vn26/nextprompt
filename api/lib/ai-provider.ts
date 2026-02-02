/**
 * AI Provider Module
 * Unified interface for Multiple AI Providers with Fallback
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
    modelName: string;
}

// DeepSeek-V3.2-Speciale - FAST (Primary for speed)
const DEEPSEEK_V3_CONFIG = {
    endpoint: process.env.DEEPSEEK_V3_ENDPOINT || "",
    modelName: "DeepSeek-V3.2-Speciale",
    deployment: "DeepSeek-V3.2-Speciale",
    apiKey: process.env.DEEPSEEK_V3_API_KEY || "",
};

// Phi-4-reasoning - SMART (Fallback 1)
const PHI4_CONFIG = {
    endpoint: process.env.AZURE_PHI4_ENDPOINT || "",
    modelName: "Phi-4-reasoning",
    deployment: process.env.AZURE_PHI4_DEPLOYMENT || "Phi-4-reasoning",
    apiKey: process.env.AZURE_PHI4_API_KEY || "",
};

// DeepSeek-R1 - REASONING (Fallback 2 - for complex tasks)
const DEEPSEEK_R1_CONFIG = {
    endpoint: process.env.DEEPSEEK_R1_ENDPOINT || "",
    modelName: "DeepSeek-R1-0528",
    deployment: "DeepSeek-R1-0528",
    apiKey: process.env.DEEPSEEK_R1_API_KEY || "",
};

// OpenAI (Fallback 3)
const OPENAI_CONFIG = {
    apiKey: process.env.OPENAI_API_KEY || "",
    modelName: "gpt-4.1-mini",
};

// Gemini (Fallback 4)
const GEMINI_CONFIG = {
    apiKey: process.env.GEMINI_API_KEY || "",
    modelName: "gemini-2.5-flash",
};

// ============================================
// Helpers
// ============================================

// Strip <think>...</think> tags from reasoning models
const stripThinkingTags = (content: string): string => {
    // Remove <think>...</think> blocks (including everything inside)
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Also handle case where </think> hasn't arrived yet (streaming)
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
    // Clean up extra whitespace
    return cleaned.trim();
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MAX_RETRIES = 1;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 5000;

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

    constructor(sessionId: string = 'default') {
        this.sessionId = sessionId;
        this.initializeClients();
    }

    private initializeClients(): void {
        if (DEEPSEEK_V3_CONFIG.apiKey) {
            this.deepseekV3Client = new OpenAI({
                baseURL: DEEPSEEK_V3_CONFIG.endpoint,
                apiKey: DEEPSEEK_V3_CONFIG.apiKey,
            });
        }

        if (PHI4_CONFIG.apiKey) {
            this.phi4Client = new OpenAI({
                baseURL: PHI4_CONFIG.endpoint,
                apiKey: PHI4_CONFIG.apiKey,
            });
        }

        if (DEEPSEEK_R1_CONFIG.apiKey) {
            this.deepseekR1Client = new OpenAI({
                baseURL: DEEPSEEK_R1_CONFIG.endpoint,
                apiKey: DEEPSEEK_R1_CONFIG.apiKey,
            });
        }

        if (OPENAI_CONFIG.apiKey) {
            this.openaiClient = new OpenAI({
                apiKey: OPENAI_CONFIG.apiKey,
            });
        }

        if (GEMINI_CONFIG.apiKey) {
            this.geminiClient = new GoogleGenerativeAI(GEMINI_CONFIG.apiKey);
            this.geminiModel = this.geminiClient.getGenerativeModel({
                model: GEMINI_CONFIG.modelName,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            });
        }
    }

    isReady(): boolean {
        return !!(this.deepseekV3Client || this.phi4Client || this.deepseekR1Client || this.openaiClient || this.geminiClient);
    }

    async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
        // Priority order: DeepSeek-V3 (fast) → Phi-4 → DeepSeek-R1 → OpenAI → Gemini

        try {
            if (this.deepseekV3Client) {
                console.log("⚡ Using DeepSeek-V3.2-Speciale (FAST)...");
                yield* this.streamWithDeepSeekV3(request);
                return;
            }
        } catch (error) {
            console.warn("⚠️ DeepSeek-V3 failed:", error);
        }

        try {
            if (this.phi4Client) {
                console.log("🟣 Falling back to Phi-4-reasoning...");
                yield* this.streamWithPhi4(request);
                return;
            }
        } catch (error) {
            console.warn("⚠️ Phi-4 failed:", error);
        }

        try {
            if (this.deepseekR1Client) {
                console.log("🧠 Falling back to DeepSeek-R1...");
                yield* this.streamWithDeepSeekR1(request);
                return;
            }
        } catch (error) {
            console.warn("⚠️ DeepSeek-R1 failed:", error);
        }

        try {
            if (this.openaiClient) {
                console.log("🔶 Falling back to OpenAI...");
                yield* this.streamWithOpenAI(request);
                return;
            }
        } catch (error) {
            console.warn("⚠️ OpenAI failed:", error);
        }

        try {
            if (this.geminiModel) {
                console.log("🔷 Falling back to Gemini...");
                yield* this.streamWithGemini(request);
                return;
            }
        } catch (error) {
            console.error("❌ All APIs failed:", error);
            throw error;
        }

        throw new Error("No AI providers configured or available.");
    }

    async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
         // Priority order: DeepSeek-V3 (fast) → Phi-4 → DeepSeek-R1 → OpenAI → Gemini

         try {
            if (this.deepseekV3Client) {
                return await this.completeWithDeepSeekV3(request);
            }
        } catch (error) {
            console.warn("DeepSeek-V3 sendMessage failed:", error);
        }

        try {
            if (this.phi4Client) {
                return await this.completeWithPhi4(request);
            }
        } catch (error) {
            console.warn("Phi-4 sendMessage failed:", error);
        }

        try {
            if (this.deepseekR1Client) {
                return await this.completeWithDeepSeekR1(request);
            }
        } catch (error) {
            console.warn("DeepSeek-R1 sendMessage failed:", error);
        }

        try {
            if (this.openaiClient) {
                return await this.completeWithOpenAI(request);
            }
        } catch (error) {
            console.warn("OpenAI sendMessage failed:", error);
        }

        try {
            if (this.geminiModel) {
                return await this.completeWithGemini(request);
            }
        } catch (error) {
             console.error("All APIs failed for sendMessage:", error);
             throw error;
        }

        throw new Error("No AI providers configured or available.");
    }

    // ============================================
    // Streaming Implementations
    // ============================================

    private async *streamWithDeepSeekV3(request: ChatRequest): AsyncGenerator<StreamChunk> {
        if (!this.deepseekV3Client) throw new Error("Client not initialized");

        const stream = await this.deepseekV3Client.chat.completions.create({
            model: DEEPSEEK_V3_CONFIG.deployment,
            messages: request.messages.map(msg => ({ role: msg.role, content: msg.content })),
            stream: true,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 4096,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            yield { content: delta, done: false };
        }
        yield { content: "", done: true };
    }

    private async *streamWithPhi4(request: ChatRequest): AsyncGenerator<StreamChunk> {
        if (!this.phi4Client) throw new Error("Client not initialized");
        const stream = await this.phi4Client.chat.completions.create({
            model: PHI4_CONFIG.deployment,
            messages: request.messages.map(msg => ({ role: msg.role, content: msg.content })),
            stream: true,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            yield { content: delta, done: false };
        }
        yield { content: "", done: true };
    }

    private async *streamWithDeepSeekR1(request: ChatRequest): AsyncGenerator<StreamChunk> {
        if (!this.deepseekR1Client) throw new Error("Client not initialized");
        const stream = await this.deepseekR1Client.chat.completions.create({
            model: DEEPSEEK_R1_CONFIG.deployment,
            messages: request.messages.map(msg => ({ role: msg.role, content: msg.content })),
            stream: true,
            temperature: 0.6,
            max_tokens: request.maxTokens ?? 4096,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            yield { content: delta, done: false };
        }
        yield { content: "", done: true };
    }

    private async *streamWithOpenAI(request: ChatRequest): AsyncGenerator<StreamChunk> {
        if (!this.openaiClient) throw new Error("Client not initialized");
        const stream = await this.openaiClient.chat.completions.create({
            model: OPENAI_CONFIG.modelName,
            messages: request.messages.map(msg => ({ role: msg.role, content: msg.content })),
            stream: true,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            yield { content: delta, done: false };
        }
        yield { content: "", done: true };
    }

    private async *streamWithGemini(request: ChatRequest): AsyncGenerator<StreamChunk> {
        if (!this.geminiModel) throw new Error("Client not initialized");

        const history = request.messages.slice(0, -1).map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        const systemMsg = request.messages.find(m => m.role === "system");

        // Gemini specific config handling
        // Note: systemInstruction is available in newer Gemini SDKs/Models
        // logic adapted from ChatService.ts

        const activeModel = systemMsg && this.geminiClient
            ? this.geminiClient.getGenerativeModel({
                model: GEMINI_CONFIG.modelName,
                systemInstruction: systemMsg.content,
                generationConfig: {
                    temperature: request.temperature ?? 0.7,
                    maxOutputTokens: request.maxTokens ?? 2048,
                }
            })
            : this.geminiModel;

        const chat = activeModel.startChat({
            history: history.filter(h => h.role !== "system"),
        });

        const lastMessage = request.messages[request.messages.length - 1].content;
        const result = await chat.sendMessageStream(lastMessage);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            yield { content: chunkText, done: false };
        }
        yield { content: "", done: true };
    }

    // ============================================
    // Completion Implementations
    // ============================================

    private async completeWithDeepSeekV3(request: ChatRequest): Promise<ChatResponse> {
        if (!this.deepseekV3Client) throw new Error("Client not initialized");
        const response = await this.deepseekV3Client.chat.completions.create({
            model: DEEPSEEK_V3_CONFIG.deployment,
            messages: request.messages.map(msg => ({ role: msg.role, content: msg.content })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 4096,
        });
        const content = response.choices[0]?.message?.content || "";
        return { content: stripThinkingTags(content), model: "DeepSeek-V3" };
    }

    private async completeWithPhi4(request: ChatRequest): Promise<ChatResponse> {
        if (!this.phi4Client) throw new Error("Client not initialized");
        const response = await this.phi4Client.chat.completions.create({
            model: PHI4_CONFIG.deployment,
            messages: request.messages.map(msg => ({ role: msg.role, content: msg.content })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
        });
        const content = response.choices[0]?.message?.content || "";
        return { content: stripThinkingTags(content), model: "Phi-4" };
    }

    private async completeWithDeepSeekR1(request: ChatRequest): Promise<ChatResponse> {
        if (!this.deepseekR1Client) throw new Error("Client not initialized");
        const response = await this.deepseekR1Client.chat.completions.create({
            model: DEEPSEEK_R1_CONFIG.deployment,
            messages: request.messages.map(msg => ({ role: msg.role, content: msg.content })),
            temperature: 0.6,
            max_tokens: request.maxTokens ?? 4096,
        });
        const content = response.choices[0]?.message?.content || "";
        return { content: stripThinkingTags(content), model: "DeepSeek-R1" };
    }

    private async completeWithOpenAI(request: ChatRequest): Promise<ChatResponse> {
        if (!this.openaiClient) throw new Error("Client not initialized");
        const response = await this.openaiClient.chat.completions.create({
            model: OPENAI_CONFIG.modelName,
            messages: request.messages.map(msg => ({ role: msg.role, content: msg.content })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
        });
        const content = response.choices[0]?.message?.content || "";
        return { content, model: "OpenAI" };
    }

    private async completeWithGemini(request: ChatRequest): Promise<ChatResponse> {
        if (!this.geminiModel) throw new Error("Client not initialized");
        const lastMessage = request.messages[request.messages.length - 1].content;
        const result = await this.geminiModel.generateContent(lastMessage);
        const response = await result.response;
        return { content: response.text(), model: "Gemini" };
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
