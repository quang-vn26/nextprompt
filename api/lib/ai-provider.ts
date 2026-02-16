/**
 * AI Provider Module
 * Centralized AI interaction logic with fallback chain:
 * DeepSeek-V3 -> Phi-4 -> DeepSeek-R1 -> OpenAI -> Gemini
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, ChatRequest, ChatResponse, StreamChunk, ChatMode } from './types';
import { logUsage } from './mongodb';

// ============================================
// Configuration
// ============================================

const DEEPSEEK_V3_CONFIG = {
    endpoint: process.env.DEEPSEEK_V3_ENDPOINT || process.env.VITE_DEEPSEEK_V3_ENDPOINT || "",
    apiKey: process.env.DEEPSEEK_V3_API_KEY || process.env.VITE_DEEPSEEK_V3_API_KEY || "",
    deployment: "DeepSeek-V3.2-Speciale",
};

const PHI4_CONFIG = {
    endpoint: process.env.PHI4_ENDPOINT || process.env.VITE_PHI4_ENDPOINT || "",
    apiKey: process.env.PHI4_API_KEY || process.env.VITE_PHI4_API_KEY || "",
    deployment: "Phi-4-reasoning",
};

const DEEPSEEK_R1_CONFIG = {
    endpoint: process.env.DEEPSEEK_R1_ENDPOINT || process.env.VITE_DEEPSEEK_R1_ENDPOINT || "",
    apiKey: process.env.DEEPSEEK_R1_API_KEY || process.env.VITE_DEEPSEEK_R1_API_KEY || "",
    deployment: "DeepSeek-R1-0528",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";

// Retry Configuration
const MAX_RETRIES = 1;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 5000;

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get retry delay
const getRetryDelay = (error: any, attempt: number): number => {
    const match = error?.message?.match(/try again in (\d+)s/i);
    if (match) {
        return Math.min(parseInt(match[1]) * 1000, MAX_DELAY_MS);
    }
    return Math.min(INITIAL_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
};

// Check if error is rate limit
const isRateLimitError = (error: any): boolean => {
    const message = error?.message?.toLowerCase() || "";
    const status = error?.status || error?.response?.status;
    return status === 429 ||
        message.includes("rate limit") ||
        message.includes("quota") ||
        message.includes("too many requests") ||
        message.includes("resource exhausted");
};

// Strip <think> tags
const stripThinkingTags = (content: string): string => {
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
    return cleaned.trim();
};

export class AIProvider {
    private deepseekV3Client: OpenAI | null = null;
    private phi4Client: OpenAI | null = null;
    private deepseekR1Client: OpenAI | null = null;
    private openaiClient: OpenAI | null = null;
    private geminiClient: GoogleGenerativeAI | null = null;

    constructor() {
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

        if (OPENAI_API_KEY) {
            this.openaiClient = new OpenAI({
                apiKey: OPENAI_API_KEY,
            });
        }

        if (GEMINI_API_KEY) {
            this.geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
        }
    }

    async chatCompletion(request: ChatRequest, sessionId: string): Promise<ChatResponse> {
        // Try DeepSeek-V3
        try {
            if (this.deepseekV3Client) {
                console.log("⚡ Using DeepSeek-V3...");
                return await this.openAIChatCompletion(this.deepseekV3Client, DEEPSEEK_V3_CONFIG.deployment, request, sessionId, "DeepSeek-V3");
            }
        } catch (e) { console.warn("DeepSeek-V3 failed:", e); }

        // Try Phi-4
        try {
            if (this.phi4Client) {
                console.log("🟣 Using Phi-4...");
                return await this.openAIChatCompletion(this.phi4Client, PHI4_CONFIG.deployment, request, sessionId, "Phi-4");
            }
        } catch (e) { console.warn("Phi-4 failed:", e); }

        // Try DeepSeek-R1
        try {
            if (this.deepseekR1Client) {
                console.log("🧠 Using DeepSeek-R1...");
                return await this.openAIChatCompletion(this.deepseekR1Client, DEEPSEEK_R1_CONFIG.deployment, request, sessionId, "DeepSeek-R1");
            }
        } catch (e) { console.warn("DeepSeek-R1 failed:", e); }

        // Try OpenAI
        try {
            if (this.openaiClient) {
                console.log("🔶 Using OpenAI...");
                return await this.openAIChatCompletion(this.openaiClient, "gpt-4o-mini", request, sessionId, "OpenAI");
            }
        } catch (e) { console.warn("OpenAI failed:", e); }

        // Try Gemini
        try {
            if (this.geminiClient) {
                console.log("🔷 Using Gemini...");
                const model = this.geminiClient.getGenerativeModel({ model: "gemini-1.5-flash" });
                const lastMsg = request.messages[request.messages.length - 1].content;
                const result = await model.generateContent(lastMsg);
                const response = result.response;
                const text = response.text();

                // Estimate tokens (Gemini doesn't always return usage in simple response)
                const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

                await logUsage(sessionId, "Gemini", usage.promptTokens, usage.completionTokens);

                return {
                    content: text,
                    model: "Gemini",
                    usage
                };
            }
        } catch (e) {
            console.error("Gemini failed:", e);
        }

        throw new Error("All AI providers failed.");
    }

    private async openAIChatCompletion(client: OpenAI, model: string, request: ChatRequest, sessionId: string, modelName: string): Promise<ChatResponse> {
        const response = await client.chat.completions.create({
            model: model,
            messages: request.messages.map(m => ({ role: m.role as any, content: m.content })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
        });

        const content = response.choices[0]?.message?.content || "";
        const usage = response.usage;

        if (usage) {
            await logUsage(sessionId, modelName, usage.prompt_tokens, usage.completion_tokens);
        }

        return {
            content: stripThinkingTags(content),
            model: modelName,
            usage: usage ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens
            } : undefined
        };
    }

    async *streamChat(request: ChatRequest, sessionId: string): AsyncGenerator<StreamChunk> {
        // Fallback Logic with Generators is tricky.
        // We need to try one, if it fails (throws), catch and try next.

        try {
            if (this.deepseekV3Client) {
                console.log("⚡ Streaming DeepSeek-V3...");
                yield* this.streamOpenAI(this.deepseekV3Client, DEEPSEEK_V3_CONFIG.deployment, request, sessionId);
                return;
            }
        } catch (e) { console.warn("DeepSeek-V3 stream failed:", e); }

        try {
            if (this.phi4Client) {
                console.log("🟣 Streaming Phi-4...");
                yield* this.streamOpenAI(this.phi4Client, PHI4_CONFIG.deployment, request, sessionId);
                return;
            }
        } catch (e) { console.warn("Phi-4 stream failed:", e); }

        try {
            if (this.deepseekR1Client) {
                console.log("🧠 Streaming DeepSeek-R1...");
                yield* this.streamOpenAI(this.deepseekR1Client, DEEPSEEK_R1_CONFIG.deployment, request, sessionId);
                return;
            }
        } catch (e) { console.warn("DeepSeek-R1 stream failed:", e); }

        try {
            if (this.openaiClient) {
                console.log("🔶 Streaming OpenAI...");
                yield* this.streamOpenAI(this.openaiClient, "gpt-4o-mini", request, sessionId);
                return;
            }
        } catch (e) { console.warn("OpenAI stream failed:", e); }

        try {
            if (this.geminiClient) {
                console.log("🔷 Streaming Gemini...");
                yield* this.streamGemini(this.geminiClient, request, sessionId);
                return;
            }
        } catch (e) { console.error("Gemini stream failed:", e); }

        throw new Error("All AI providers failed to stream.");
    }

    private async *streamOpenAI(client: OpenAI, model: string, request: ChatRequest, sessionId: string): AsyncGenerator<StreamChunk> {
        const stream = await client.chat.completions.create({
            model: model,
            messages: request.messages.map(m => ({ role: m.role as any, content: m.content })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
            stream: true,
        });

        let accumulatedContent = "";

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            accumulatedContent += delta;

            const cleanContent = stripThinkingTags(accumulatedContent);
            // We only yield if there is new content visible (after stripping tags)
            // But to keep it simple and responsive, we might just yield everything and let frontend handle?
            // The prompt code stripped tags. We should probably strip tags here to be safe.
            // But streaming stripped content is hard because we might be inside a tag.
            // Simplified approach: just yield the delta, let frontend or final accumulator handle it?
            // No, the requirement was to strip thinking tags.
            // Let's rely on the final accumulation for correctness, but for streaming,
            // we yield the full text so far? No, SSE usually sends deltas.
            // If we send deltas, we can't easily strip tags that span chunks.
            // Let's send the *full accumulated content* in each chunk? No, that's inefficient.
            // The previous code yielded { content: accumulatedContent }.

            yield {
                content: stripThinkingTags(accumulatedContent),
                done: false
            };
        }

        // Log usage (estimated)
        // OpenAI stream doesn't always return usage.
        await logUsage(sessionId, model, Math.ceil(accumulatedContent.length / 4), 0); // Rough estimate

        yield {
            content: stripThinkingTags(accumulatedContent),
            done: true
        };
    }

    private async *streamGemini(client: GoogleGenerativeAI, request: ChatRequest, sessionId: string): AsyncGenerator<StreamChunk> {
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        const history = request.messages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        const lastMsg = request.messages[request.messages.length - 1].content;

        const chat = model.startChat({
            history: history as any,
        });

        const result = await chat.sendMessageStream(lastMsg);
        let accumulatedContent = "";

        for await (const chunk of result.stream) {
            const text = chunk.text();
            accumulatedContent += text;
            yield {
                content: accumulatedContent,
                done: false
            };
        }

        await logUsage(sessionId, "Gemini", Math.ceil(accumulatedContent.length / 4), 0);

        yield {
            content: accumulatedContent,
            done: true
        };
    }

    isReady(): boolean {
        return !!(this.deepseekV3Client || this.phi4Client || this.deepseekR1Client || this.openaiClient || this.geminiClient);
    }
}

// Singleton instance
let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
    if (!providerInstance) {
        providerInstance = new AIProvider();
    }
    return providerInstance;
}
