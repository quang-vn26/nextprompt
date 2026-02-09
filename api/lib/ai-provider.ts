/**
 * AI Provider Module
 * Unified interface for multiple AI providers with fallback logic
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage, ChatRequest, ChatResponse, StreamChunk, ChatMode } from './types';
import { logUsage } from './mongodb';

// ============================================
// Configuration
// ============================================

interface ProviderConfig {
    endpoint?: string;
    apiKey: string;
    deployment?: string; // Model name for OpenAI/DeepSeek
    modelName?: string; // Internal name for logging/logic
}

// DeepSeek-V3.2-Speciale - FAST (Primary)
const DEEPSEEK_V3_CONFIG: ProviderConfig = {
    endpoint: process.env.DEEPSEEK_V3_ENDPOINT || process.env.VITE_DEEPSEEK_V3_ENDPOINT,
    apiKey: process.env.DEEPSEEK_V3_API_KEY || process.env.VITE_DEEPSEEK_V3_API_KEY || '',
    deployment: 'DeepSeek-V3.2-Speciale',
    modelName: 'DeepSeek-V3.2-Speciale'
};

// Phi-4-reasoning - SMART (Fallback 1)
const PHI4_CONFIG: ProviderConfig = {
    endpoint: process.env.PHI4_ENDPOINT || process.env.VITE_PHI4_ENDPOINT,
    apiKey: process.env.PHI4_API_KEY || process.env.VITE_PHI4_API_KEY || '',
    deployment: 'Phi-4-reasoning',
    modelName: 'Phi-4-reasoning'
};

// DeepSeek-R1 - REASONING (Fallback 2)
const DEEPSEEK_R1_CONFIG: ProviderConfig = {
    endpoint: process.env.DEEPSEEK_R1_ENDPOINT || process.env.VITE_DEEPSEEK_R1_ENDPOINT,
    apiKey: process.env.DEEPSEEK_R1_API_KEY || process.env.VITE_DEEPSEEK_R1_API_KEY || '',
    deployment: 'DeepSeek-R1-0528',
    modelName: 'DeepSeek-R1-0528'
};

// OpenAI - FALLBACK 3
const OPENAI_CONFIG: ProviderConfig = {
    apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
    deployment: 'gpt-4.1-mini', // Default model
    modelName: 'gpt-4.1-mini'
};

// Gemini - FALLBACK 4
const GEMINI_CONFIG: ProviderConfig = {
    apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
    deployment: 'gemini-2.5-flash',
    modelName: 'gemini-2.5-flash'
};

// Helper function to strip thinking tags
const stripThinkingTags = (content: string): string => {
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
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

    private sessionId: string;

    constructor(sessionId: string = 'default') {
        this.sessionId = sessionId;
        this.initializeClients();
    }

    private initializeClients(): void {
        // DeepSeek-V3
        if (DEEPSEEK_V3_CONFIG.apiKey && DEEPSEEK_V3_CONFIG.endpoint) {
            this.deepseekV3Client = new OpenAI({
                baseURL: DEEPSEEK_V3_CONFIG.endpoint,
                apiKey: DEEPSEEK_V3_CONFIG.apiKey,
            });
        }

        // Phi-4
        if (PHI4_CONFIG.apiKey && PHI4_CONFIG.endpoint) {
            this.phi4Client = new OpenAI({
                baseURL: PHI4_CONFIG.endpoint,
                apiKey: PHI4_CONFIG.apiKey,
            });
        }

        // DeepSeek-R1
        if (DEEPSEEK_R1_CONFIG.apiKey && DEEPSEEK_R1_CONFIG.endpoint) {
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
        }
    }

    async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
        // Fallback chain: DeepSeek-V3 -> Phi-4 -> DeepSeek-R1 -> OpenAI -> Gemini

        try {
            if (this.deepseekV3Client) {
                console.log("⚡ Using DeepSeek-V3...");
                yield* this.streamOpenAICompatible(this.deepseekV3Client, DEEPSEEK_V3_CONFIG.deployment!, request, true);
                return;
            }
        } catch (e) {
            console.warn("⚠️ DeepSeek-V3 failed:", e);
        }

        try {
            if (this.phi4Client) {
                console.log("🟣 Using Phi-4...");
                yield* this.streamOpenAICompatible(this.phi4Client, PHI4_CONFIG.deployment!, request, true);
                return;
            }
        } catch (e) {
            console.warn("⚠️ Phi-4 failed:", e);
        }

        try {
            if (this.deepseekR1Client) {
                console.log("🧠 Using DeepSeek-R1...");
                yield* this.streamOpenAICompatible(this.deepseekR1Client, DEEPSEEK_R1_CONFIG.deployment!, request, true);
                return;
            }
        } catch (e) {
            console.warn("⚠️ DeepSeek-R1 failed:", e);
        }

        try {
            if (this.openaiClient) {
                console.log("🔶 Using OpenAI...");
                yield* this.streamOpenAICompatible(this.openaiClient, OPENAI_CONFIG.deployment!, request, false);
                return;
            }
        } catch (e) {
            console.warn("⚠️ OpenAI failed:", e);
        }

        try {
            if (this.geminiClient) {
                console.log("🔷 Using Gemini...");
                yield* this.streamGemini(request);
                return;
            }
        } catch (e) {
            console.warn("⚠️ Gemini failed:", e);
        }

        throw new Error("All AI providers failed or are not configured.");
    }

    private async *streamOpenAICompatible(
        client: OpenAI,
        model: string,
        request: ChatRequest,
        stripThinking: boolean
    ): AsyncGenerator<StreamChunk> {
        const stream = await client.chat.completions.create({
            model: model,
            messages: request.messages.map(m => ({ role: m.role, content: m.content })),
            stream: true,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
        });

        let rawAccumulated = "";
        let lastCleanedLength = 0;

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            rawAccumulated += content;

            if (stripThinking) {
                const cleaned = stripThinkingTags(rawAccumulated);
                if (cleaned.length > lastCleanedLength) {
                    const delta = cleaned.substring(lastCleanedLength);
                    lastCleanedLength = cleaned.length;
                    yield { content: delta, done: false };
                }
            } else {
                yield { content: content, done: false };
            }
        }

        yield { content: "", done: true };
    }

    private async *streamGemini(request: ChatRequest): AsyncGenerator<StreamChunk> {
        const model = this.geminiClient!.getGenerativeModel({
            model: GEMINI_CONFIG.deployment!,
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 2048,
            }
        });

        const history = request.messages.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: history.filter(h => h.role !== 'system'),
            systemInstruction: request.messages.find(m => m.role === 'system')?.content
        });

        const lastMessage = request.messages[request.messages.length - 1].content;
        const result = await chat.sendMessageStream(lastMessage);

        for await (const chunk of result.stream) {
            const text = chunk.text();
            yield { content: text, done: false };
        }
        yield { content: "", done: true };
    }

    // Keep chatCompletion for non-streaming usage if needed, utilizing the same fallback logic
    async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
        // Collect stream into a single response
        let finalContent = "";
        let modelUsed = "unknown";

        const iterator = this.streamChat(request);
        for await (const chunk of iterator) {
            if (chunk.done) break;
            finalContent += chunk.content;
        }

        return {
            content: finalContent,
            model: modelUsed,
            // usage: ...
        };
    }

    isReady(): boolean {
        return !!(this.deepseekV3Client || this.phi4Client || this.deepseekR1Client || this.openaiClient || this.geminiClient);
    }
}

// ============================================
// Singleton instance
// ============================================

let providerInstance: AIProvider | null = null;

export function getAIProvider(sessionId?: string): AIProvider {
    if (!providerInstance) {
        providerInstance = new AIProvider(sessionId);
    }
    return providerInstance;
}
