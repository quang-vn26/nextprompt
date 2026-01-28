/**
 * AI Provider Module
 * Unified interface for Azure OpenAI, Azure AI (Phi-4), and Google Gemini
 * Implements fallback logic: Phi-4 -> OpenAI -> Gemini
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

// Azure OpenAI (o4-mini) - Primary for fast responses or Fallback
const AZURE_OPENAI_CONFIG: ProviderConfig = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'o4-mini',
};

// Azure AI (Phi-4-reasoning) - Primary for reasoning
const AZURE_PHI4_CONFIG: ProviderConfig = {
    endpoint: process.env.AZURE_PHI4_ENDPOINT || process.env.VITE_PHI4_ENDPOINT || '',
    apiKey: process.env.AZURE_PHI4_API_KEY || process.env.VITE_PHI4_API_KEY || '',
    deployment: process.env.AZURE_PHI4_DEPLOYMENT || 'Phi-4-reasoning',
};

// Gemini Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

// ============================================
// AI Provider Class
// ============================================

export class AIProvider {
    private o4MiniClient: OpenAI | null = null;
    private phi4Client: OpenAI | null = null;
    private geminiClient: GoogleGenerativeAI | null = null;
    private geminiModel: any = null;
    private sessionId: string;

    constructor(sessionId: string = 'default') {
        this.sessionId = sessionId;
        this.initializeClients();
    }

    /**
     * Initialize AI clients
     */
    private initializeClients(): void {
        // Initialize o4-mini client
        if (AZURE_OPENAI_CONFIG.apiKey) {
            this.o4MiniClient = new OpenAI({
                baseURL: AZURE_OPENAI_CONFIG.endpoint,
                apiKey: AZURE_OPENAI_CONFIG.apiKey,
            });
            console.log('✅ Azure OpenAI (o4-mini) client initialized');
        } else {
            console.warn('⚠️ Azure OpenAI API key not configured');
        }

        // Initialize Phi-4 client
        if (AZURE_PHI4_CONFIG.apiKey) {
            this.phi4Client = new OpenAI({
                baseURL: AZURE_PHI4_CONFIG.endpoint,
                apiKey: AZURE_PHI4_CONFIG.apiKey,
            });
            console.log('✅ Azure AI (Phi-4-reasoning) client initialized');
        } else {
            console.warn('⚠️ Azure Phi-4 API key not configured');
        }

        // Initialize Gemini client
        if (GEMINI_API_KEY) {
            this.geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
            this.geminiModel = this.geminiClient.getGenerativeModel({ model: "gemini-2.5-flash" });
            console.log('✅ Gemini (gemini-2.5-flash) client initialized');
        } else {
            console.warn('⚠️ Gemini API key not configured');
        }
    }

    /**
     * Stream chat completion with automatic fallback
     * Strategy: Phi-4 -> OpenAI -> Gemini
     */
    async *streamChatWithFallback(request: ChatRequest): AsyncGenerator<StreamChunk> {
        let lastError: any;

        // 1. Try Phi-4 (if configured)
        if (this.phi4Client) {
            try {
                console.log('🟣 Using Phi-4 (Azure AI)...');
                const generator = this.streamOpenAI(this.phi4Client, AZURE_PHI4_CONFIG.deployment, request);
                for await (const chunk of generator) {
                    yield chunk;
                }
                return; // Success
            } catch (error) {
                console.warn('⚠️ Phi-4 API failed:', error);
                lastError = error;
            }
        }

        // 2. Try OpenAI (if configured)
        if (this.o4MiniClient) {
            try {
                console.log('🔶 Falling back to OpenAI (o4-mini)...');
                const generator = this.streamOpenAI(this.o4MiniClient, AZURE_OPENAI_CONFIG.deployment, request);
                for await (const chunk of generator) {
                    yield chunk;
                }
                return; // Success
            } catch (error) {
                console.warn('⚠️ OpenAI API failed:', error);
                lastError = error;
            }
        }

        // 3. Try Gemini (if configured)
        if (this.geminiModel) {
            try {
                console.log('🔷 Falling back to Gemini...');
                const generator = this.streamGemini(request);
                for await (const chunk of generator) {
                    yield chunk;
                }
                return; // Success
            } catch (error) {
                console.warn('⚠️ Gemini API failed:', error);
                lastError = error;
            }
        }

        // If we get here, all providers failed
        throw lastError || new Error('No AI providers available or all failed.');
    }

    /**
     * Helper to stream from OpenAI-compatible clients
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

            yield {
                content: accumulatedContent,
                done: false,
            };
        }

        yield {
            content: accumulatedContent,
            done: true,
        };

        // Log usage (approximate since streaming doesn't give usage in v1)
        this.safeLogUsage(model, request.messages.length * 10, accumulatedContent.length / 4);
    }

    /**
     * Helper to stream from Gemini
     */
    private async *streamGemini(request: ChatRequest): AsyncGenerator<StreamChunk> {
        if (!this.geminiModel) throw new Error('Gemini not initialized');

        // Convert messages to Gemini format
        // Gemini expects history + current message.
        // History roles: 'user' or 'model'
        const history = request.messages.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

        const lastMessage = request.messages[request.messages.length - 1];
        if (!lastMessage) throw new Error('No messages provided');

        const chat = this.geminiModel.startChat({
            history: history.filter(h => h.role === 'user' || h.role === 'model'),
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 2048,
            },
        });

        const result = await chat.sendMessageStream(lastMessage.content);
        let accumulatedContent = '';

        for await (const chunk of result.stream) {
            const text = chunk.text();
            accumulatedContent += text;
            yield {
                content: accumulatedContent,
                done: false,
            };
        }

        yield {
            content: accumulatedContent,
            done: true,
        };

        this.safeLogUsage('gemini-2.5-flash', request.messages.length * 10, accumulatedContent.length / 4);
    }

    /**
     * Safely log usage to MongoDB without throwing errors
     */
    private async safeLogUsage(model: string, promptTokens: number, completionTokens: number) {
        try {
            await logUsage(
                this.sessionId,
                model,
                Math.round(promptTokens),
                Math.round(completionTokens)
            );
        } catch (error) {
            // Ignore DB logging errors to keep chat functional
            console.warn('⚠️ Failed to log usage to MongoDB:', error);
        }
    }

    /**
     * Get available models info
     */
    getAvailableModels(): { name: string; available: boolean }[] {
        return [
            { name: 'o4-mini', available: !!this.o4MiniClient },
            { name: 'Phi-4-reasoning', available: !!this.phi4Client },
            { name: 'gemini-2.5-flash', available: !!this.geminiClient },
        ];
    }

    /**
     * Check if at least one provider is ready
     */
    isReady(): boolean {
        return !!(this.o4MiniClient || this.phi4Client || this.geminiClient);
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
