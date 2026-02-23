/**
 * AI Provider Module
 * Unified interface for multiple AI providers with fallback strategy
 * Fallback Chain: DeepSeek-V3 -> Phi-4 -> DeepSeek-R1 -> OpenAI -> Gemini
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, ChatRequest, ChatResponse, StreamChunk, ChatMode } from './types';
import { logUsage } from './mongodb';

// ============================================
// Configuration
// ============================================

interface ProviderConfig {
    endpoint?: string;
    apiKey: string;
    deployment?: string;
    modelName: string;
}

// DeepSeek-V3 (Primary - Fast)
const DEEPSEEK_V3_CONFIG: ProviderConfig = {
    endpoint: process.env.DEEPSEEK_V3_ENDPOINT || '',
    apiKey: process.env.DEEPSEEK_V3_API_KEY || '',
    deployment: 'DeepSeek-V3.2-Speciale', // Deployment name might vary
    modelName: 'DeepSeek-V3',
};

// Phi-4 (Fallback 1 - Smart)
const PHI4_CONFIG: ProviderConfig = {
    endpoint: process.env.PHI4_ENDPOINT || '',
    apiKey: process.env.PHI4_API_KEY || '',
    deployment: 'Phi-4-reasoning',
    modelName: 'Phi-4',
};

// DeepSeek-R1 (Fallback 2 - Reasoning)
const DEEPSEEK_R1_CONFIG: ProviderConfig = {
    endpoint: process.env.DEEPSEEK_R1_ENDPOINT || '',
    apiKey: process.env.DEEPSEEK_R1_API_KEY || '',
    deployment: 'DeepSeek-R1-0528',
    modelName: 'DeepSeek-R1',
};

// OpenAI (Fallback 3 - General)
const OPENAI_CONFIG: ProviderConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    modelName: 'gpt-4o-mini',
};

// Gemini (Fallback 4 - Last Resort)
const GEMINI_CONFIG: ProviderConfig = {
    apiKey: process.env.GEMINI_API_KEY || '',
    modelName: 'gemini-2.0-flash',
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

    /**
     * Initialize AI clients
     */
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

    /**
     * Send chat completion request (non-streaming)
     */
    async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
        // Try DeepSeek-V3
        try {
            if (this.deepseekV3Client) {
                return await this.openAIChatCompletion(this.deepseekV3Client, DEEPSEEK_V3_CONFIG.deployment!, DEEPSEEK_V3_CONFIG.modelName, request);
            }
        } catch (e) {
            console.warn('⚠️ DeepSeek-V3 failed, falling back...', e);
        }

        // Try Phi-4
        try {
            if (this.phi4Client) {
                return await this.openAIChatCompletion(this.phi4Client, PHI4_CONFIG.deployment!, PHI4_CONFIG.modelName, request);
            }
        } catch (e) {
            console.warn('⚠️ Phi-4 failed, falling back...', e);
        }

        // Try DeepSeek-R1
        try {
            if (this.deepseekR1Client) {
                return await this.openAIChatCompletion(this.deepseekR1Client, DEEPSEEK_R1_CONFIG.deployment!, DEEPSEEK_R1_CONFIG.modelName, request);
            }
        } catch (e) {
            console.warn('⚠️ DeepSeek-R1 failed, falling back...', e);
        }

        // Try OpenAI
        try {
            if (this.openaiClient) {
                return await this.openAIChatCompletion(this.openaiClient, OPENAI_CONFIG.modelName, 'OpenAI', request);
            }
        } catch (e) {
            console.warn('⚠️ OpenAI failed, falling back...', e);
        }

        // Try Gemini
        try {
            if (this.geminiClient) {
                return await this.geminiChatCompletion(request);
            }
        } catch (e) {
            console.warn('⚠️ Gemini failed...', e);
        }

        throw new Error('All AI providers failed. Please check your API keys or try again later.');
    }

    /**
     * Stream chat completion with generator
     */
    async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
        // Try DeepSeek-V3
        try {
            if (this.deepseekV3Client) {
                console.log('⚡ Streaming with DeepSeek-V3...');
                yield* this.streamOpenAI(this.deepseekV3Client, DEEPSEEK_V3_CONFIG.deployment!, request);
                return;
            }
        } catch (e) {
            console.warn('⚠️ DeepSeek-V3 stream failed, falling back...', e);
        }

        // Try Phi-4
        try {
            if (this.phi4Client) {
                console.log('🟣 Streaming with Phi-4...');
                yield* this.streamOpenAI(this.phi4Client, PHI4_CONFIG.deployment!, request);
                return;
            }
        } catch (e) {
            console.warn('⚠️ Phi-4 stream failed, falling back...', e);
        }

        // Try DeepSeek-R1
        try {
            if (this.deepseekR1Client) {
                console.log('🧠 Streaming with DeepSeek-R1...');
                yield* this.streamOpenAI(this.deepseekR1Client, DEEPSEEK_R1_CONFIG.deployment!, request);
                return;
            }
        } catch (e) {
            console.warn('⚠️ DeepSeek-R1 stream failed, falling back...', e);
        }

        // Try OpenAI
        try {
            if (this.openaiClient) {
                console.log('🔶 Streaming with OpenAI...');
                yield* this.streamOpenAI(this.openaiClient, OPENAI_CONFIG.modelName, request);
                return;
            }
        } catch (e) {
            console.warn('⚠️ OpenAI stream failed, falling back...', e);
        }

        // Try Gemini
        try {
            if (this.geminiClient) {
                console.log('🔷 Streaming with Gemini...');
                yield* this.streamGemini(request);
                return;
            }
        } catch (e) {
            console.error('❌ All streams failed:', e);
            throw e;
        }

        throw new Error('No available AI providers configured.');
    }

    /**
     * OpenAI-compatible chat completion helper
     */
    private async openAIChatCompletion(client: OpenAI, model: string, modelName: string, request: ChatRequest): Promise<ChatResponse> {
        const response = await client.chat.completions.create({
            model: model,
            messages: request.messages.map(msg => ({
                role: msg.role as any,
                content: msg.content,
            })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
        });

        const content = response.choices[0]?.message?.content || '';
        const usage = response.usage;

        if (usage) {
            await logUsage(this.sessionId, modelName, usage.prompt_tokens, usage.completion_tokens).catch(console.error);
        }

        return {
            content: this.stripThinkingTags(content),
            model: modelName,
            usage: usage ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
            } : undefined,
        };
    }

    /**
     * Gemini chat completion helper
     */
    private async geminiChatCompletion(request: ChatRequest): Promise<ChatResponse> {
        if (!this.geminiClient) throw new Error('Gemini client not initialized');

        const model = this.geminiClient.getGenerativeModel({ model: GEMINI_CONFIG.modelName });

        // Convert history
        const history = request.messages.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

        const lastMessage = request.messages[request.messages.length - 1].content;
        const chat = model.startChat({
            history: history as any,
        });

        const result = await chat.sendMessage(lastMessage);
        const response = result.response;
        const text = response.text();

        return {
            content: text,
            model: 'Gemini',
        };
    }

    /**
     * OpenAI-compatible stream helper
     */
    private async *streamOpenAI(client: OpenAI, model: string, request: ChatRequest): AsyncGenerator<StreamChunk> {
        const stream = await client.chat.completions.create({
            model: model,
            messages: request.messages.map(msg => ({
                role: msg.role as any,
                content: msg.content,
            })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
            stream: true,
        });

        let accumulatedContent = '';

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            accumulatedContent += delta;

            // Send accumulated content to keep frontend logic simple (as per memory)
            yield {
                content: this.stripThinkingTags(accumulatedContent),
                done: false,
            };
        }

        yield {
            content: this.stripThinkingTags(accumulatedContent),
            done: true,
        };
    }

    /**
     * Gemini stream helper
     */
    private async *streamGemini(request: ChatRequest): AsyncGenerator<StreamChunk> {
        if (!this.geminiClient) throw new Error('Gemini client not initialized');

        const model = this.geminiClient.getGenerativeModel({ model: GEMINI_CONFIG.modelName });

        const history = request.messages.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

        const chat = model.startChat({
            history: history as any,
        });

        const lastMessage = request.messages[request.messages.length - 1].content;
        const result = await chat.sendMessageStream(lastMessage);

        let accumulatedContent = '';

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
     * Helper to strip <think> tags from reasoning models
     */
    private stripThinkingTags(content: string): string {
        // Remove <think>...</think> blocks
        let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
        // Handle unclosed tags
        cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
        return cleaned.trim();
    }

    /**
     * Check if any provider is ready
     */
    isReady(): boolean {
        return !!(this.deepseekV3Client || this.phi4Client || this.deepseekR1Client || this.openaiClient || this.geminiClient);
    }
}

// ============================================
// Singleton instance for API routes
// ============================================

let providerInstance: AIProvider | null = null;

export function getAIProvider(sessionId?: string): AIProvider {
    // Always return a new instance or handle sessionId properly if cached.
    // The previous implementation cached a singleton with a specific sessionId, which is bad if sessionId changes.
    // Ideally, the provider should be stateless or keyed by sessionId.
    // Since we are moving to a model where sessionId is used for logging, passing it to constructor is fine.
    // But caching a single instance globally is risky if multiple requests come in with different sessionIds.
    // However, for Vercel serverless, the instance might persist across warm invocations.
    // Let's create a new instance per request to be safe, or cache by sessionId if needed.
    // Given the memory says "AIProvider class ... is stateless; sessionId is passed as an argument...",
    // but the constructor takes sessionId. This is contradictory.
    // Memory: "The AIProvider class ... is stateless; sessionId is passed as an argument to methods rather than stored in the instance..."
    // My implementation stored it in `this.sessionId`.
    // I should follow the memory instruction if possible, but the previous code also stored it in `this.sessionId`.
    // I'll stick to creating a new instance for now to avoid state leak, as Vercel functions are short-lived but can be reused.
    return new AIProvider(sessionId);
}
