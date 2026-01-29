/**
 * AI Provider Module
 * Unified interface for Multi-Provider AI System
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage, ChatRequest, ChatResponse, StreamChunk, ChatMode, AIModelType } from './types';
import { logUsage } from './mongodb';

// ============================================
// Configuration
// ============================================

interface ProviderConfig {
    endpoint?: string;
    apiKey: string;
    deployment: string;
    modelName: AIModelType;
}

// DeepSeek-V3 (FAST)
const DEEPSEEK_V3_CONFIG: ProviderConfig = {
    endpoint: process.env.DEEPSEEK_V3_ENDPOINT,
    apiKey: process.env.DEEPSEEK_V3_API_KEY || '',
    deployment: 'DeepSeek-V3.2-Speciale',
    modelName: 'deepseek-v3'
};

// Phi-4 (SMART - Fallback 1)
const PHI4_CONFIG: ProviderConfig = {
    endpoint: process.env.AZURE_PHI4_ENDPOINT,
    apiKey: process.env.AZURE_PHI4_API_KEY || '',
    deployment: process.env.AZURE_PHI4_DEPLOYMENT || 'Phi-4-reasoning',
    modelName: 'phi-4-reasoning'
};

// DeepSeek-R1 (REASONING - Fallback 2)
const DEEPSEEK_R1_CONFIG: ProviderConfig = {
    endpoint: process.env.DEEPSEEK_R1_ENDPOINT,
    apiKey: process.env.DEEPSEEK_R1_API_KEY || '',
    deployment: 'DeepSeek-R1-0528',
    modelName: 'deepseek-r1'
};

// OpenAI (FALLBACK 3)
const OPENAI_CONFIG = {
    apiKey: process.env.OPENAI_API_KEY || '',
    modelName: 'gpt-4o-mini' as AIModelType
};

// Gemini (FALLBACK 4)
const GEMINI_CONFIG = {
    apiKey: process.env.GEMINI_API_KEY || '',
    modelName: 'gemini-2.5-flash' as AIModelType
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
        // DeepSeek V3
        if (DEEPSEEK_V3_CONFIG.apiKey && DEEPSEEK_V3_CONFIG.endpoint) {
            this.deepseekV3Client = new OpenAI({
                baseURL: DEEPSEEK_V3_CONFIG.endpoint,
                apiKey: DEEPSEEK_V3_CONFIG.apiKey,
            });
            console.log('✅ DeepSeek V3 initialized');
        }

        // Phi-4
        if (PHI4_CONFIG.apiKey && PHI4_CONFIG.endpoint) {
            this.phi4Client = new OpenAI({
                baseURL: PHI4_CONFIG.endpoint,
                apiKey: PHI4_CONFIG.apiKey,
            });
            console.log('✅ Phi-4 initialized');
        }

        // DeepSeek R1
        if (DEEPSEEK_R1_CONFIG.apiKey && DEEPSEEK_R1_CONFIG.endpoint) {
            this.deepseekR1Client = new OpenAI({
                baseURL: DEEPSEEK_R1_CONFIG.endpoint,
                apiKey: DEEPSEEK_R1_CONFIG.apiKey,
            });
            console.log('✅ DeepSeek R1 initialized');
        }

        // OpenAI
        if (OPENAI_CONFIG.apiKey) {
            this.openaiClient = new OpenAI({
                apiKey: OPENAI_CONFIG.apiKey,
            });
            console.log('✅ OpenAI initialized');
        }

        // Gemini
        if (GEMINI_CONFIG.apiKey) {
            this.geminiClient = new GoogleGenerativeAI(GEMINI_CONFIG.apiKey);
            console.log('✅ Gemini initialized');
        }
    }

    isReady(): boolean {
        return !!(this.deepseekV3Client || this.phi4Client || this.deepseekR1Client || this.openaiClient || this.geminiClient);
    }

    /**
     * Stream with OpenAI Compatible Client
     */
    private async *streamWithOpenAICompatible(
        client: OpenAI,
        deployment: string,
        modelName: string,
        request: ChatRequest
    ): AsyncGenerator<StreamChunk> {
        console.log(`🤖 Using ${modelName}...`);

        const stream = await client.chat.completions.create({
            model: deployment,
            messages: request.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
            stream: true,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            yield {
                content: delta,
                done: false
            };
        }
    }

    /**
     * Stream with Gemini
     */
    private async *streamWithGemini(request: ChatRequest): AsyncGenerator<StreamChunk> {
        if (!this.geminiClient) throw new Error("Gemini not initialized");

        console.log(`🤖 Using Gemini...`);
        const model = this.geminiClient.getGenerativeModel({
            model: GEMINI_CONFIG.modelName,
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 2048,
            }
        });

        const history = request.messages.slice(0, -1).map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        const lastMessage = request.messages[request.messages.length - 1].content;

        // Handle system message if present (Gemini specific)
        const systemMsg = request.messages.find(m => m.role === "system");
        if (systemMsg) {
            // Re-initialize model with system instruction if needed or just prepend to history
            // Simpler to just prepend to history as user/model turn if model doesn't support systemInstruction in this SDK version easily
            // But GoogleGenerativeAI supports systemInstruction in `getGenerativeModel`.
             // checking types... assuming latest SDK.
        }

        const chat = model.startChat({
            history: history.filter(h => h.role !== "system"),
            systemInstruction: systemMsg ? systemMsg.content : undefined
        });

        const result = await chat.sendMessageStream(lastMessage);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            yield {
                content: chunkText,
                done: false
            };
        }
    }

    /**
     * Fallback Stream Strategy
     */
    async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
        // Priority: DeepSeek V3 -> Phi-4 -> DeepSeek R1 -> OpenAI -> Gemini

        // 1. DeepSeek V3
        if (this.deepseekV3Client) {
            try {
                yield* this.streamWithOpenAICompatible(
                    this.deepseekV3Client,
                    DEEPSEEK_V3_CONFIG.deployment,
                    DEEPSEEK_V3_CONFIG.modelName,
                    request
                );
                yield { content: '', done: true };
                return;
            } catch (e) {
                console.warn('DeepSeek V3 failed, falling back...', e);
            }
        }

        // 2. Phi-4
        if (this.phi4Client) {
            try {
                yield* this.streamWithOpenAICompatible(
                    this.phi4Client,
                    PHI4_CONFIG.deployment,
                    PHI4_CONFIG.modelName,
                    request
                );
                yield { content: '', done: true };
                return;
            } catch (e) {
                console.warn('Phi-4 failed, falling back...', e);
            }
        }

        // 3. DeepSeek R1
        if (this.deepseekR1Client) {
            try {
                yield* this.streamWithOpenAICompatible(
                    this.deepseekR1Client,
                    DEEPSEEK_R1_CONFIG.deployment,
                    DEEPSEEK_R1_CONFIG.modelName,
                    request
                );
                yield { content: '', done: true };
                return;
            } catch (e) {
                console.warn('DeepSeek R1 failed, falling back...', e);
            }
        }

        // 4. OpenAI
        if (this.openaiClient) {
            try {
                yield* this.streamWithOpenAICompatible(
                    this.openaiClient,
                    OPENAI_CONFIG.modelName,
                    OPENAI_CONFIG.modelName,
                    request
                );
                yield { content: '', done: true };
                return;
            } catch (e) {
                console.warn('OpenAI failed, falling back...', e);
            }
        }

        // 5. Gemini
        if (this.geminiClient) {
            try {
                yield* this.streamWithGemini(request);
                yield { content: '', done: true };
                return;
            } catch (e) {
                console.error('Gemini failed', e);
            }
        }

        throw new Error("All AI providers failed.");
    }

    /**
     * Chat Completion (Non-streaming) - Simplified to just use streaming logic and accumulate
     */
    async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
        let content = '';
        let model = 'unknown';

        const generator = this.streamChat(request);
        for await (const chunk of generator) {
            content += chunk.content;
            if (chunk.done) break;
        }

        // Note: Tracking which model was actually used in the fallback chain is tricky with this generator approach
        // unless we yield metadata.
        // For now, return "auto-fallback".

        return {
            content,
            model: 'auto-fallback'
        };
    }

    getAvailableModels(): { name: string; available: boolean }[] {
        return [
            { name: 'DeepSeek-V3', available: !!this.deepseekV3Client },
            { name: 'Phi-4', available: !!this.phi4Client },
            { name: 'DeepSeek-R1', available: !!this.deepseekR1Client },
            { name: 'OpenAI', available: !!this.openaiClient },
            { name: 'Gemini', available: !!this.geminiClient },
        ];
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
