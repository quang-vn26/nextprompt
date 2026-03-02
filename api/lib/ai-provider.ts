/**
 * AI Provider Module
 * Unified interface for Azure OpenAI (o4-mini) and Azure AI (Phi-4-reasoning)
 */

import OpenAI from 'openai';
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

// Azure OpenAI (o4-mini) - Primary for fast responses
const AZURE_OPENAI_CONFIG: ProviderConfig = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'o4-mini',
};

// Azure AI (Phi-4-reasoning) - For deep thinking
const AZURE_PHI4_CONFIG: ProviderConfig = {
    endpoint: process.env.AZURE_PHI4_ENDPOINT || '',
    apiKey: process.env.AZURE_PHI4_API_KEY || '',
    deployment: process.env.AZURE_PHI4_DEPLOYMENT || 'Phi-4-reasoning',
};

// ============================================
// AI Provider Class
// ============================================

export class AIProvider {
    private o4MiniClient: OpenAI | null = null;
    private phi4Client: OpenAI | null = null;

    constructor() {
        this.initializeClients();
    }

    /**
     * Initialize OpenAI-compatible clients
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
    }

    /**
     * Get appropriate client based on mode
     */
    private getClient(mode: ChatMode): { client: OpenAI; deployment: string; modelName: string } {
        if (mode === 'fast' && this.o4MiniClient) {
            return {
                client: this.o4MiniClient,
                deployment: AZURE_OPENAI_CONFIG.deployment,
                modelName: 'o4-mini',
            };
        } else if (this.phi4Client) {
            return {
                client: this.phi4Client,
                deployment: AZURE_PHI4_CONFIG.deployment,
                modelName: 'Phi-4-reasoning',
            };
        } else if (this.o4MiniClient) {
            // Fallback to o4-mini if Phi-4 not available
            return {
                client: this.o4MiniClient,
                deployment: AZURE_OPENAI_CONFIG.deployment,
                modelName: 'o4-mini',
            };
        }

        throw new Error('No AI provider available. Please check your API keys.');
    }

    /**
     * Send chat completion request (non-streaming)
     */
    async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
        const mode = request.model || 'fast';
        const { client, deployment, modelName } = this.getClient(mode);

        console.log(`🤖 Using ${modelName} for chat completion...`);

        const response = await client.chat.completions.create({
            model: deployment,
            messages: request.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 2048,
        });

        const content = response.choices[0]?.message?.content || '';
        const usage = response.usage;

        // Log usage to MongoDB
        if (usage) {
            await logUsage(
                request.sessionId || 'anonymous',
                modelName,
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }

        return {
            content,
            model: modelName,
            usage: usage ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
            } : undefined,
        };
    }

    /**
     * Stream chat completion with generator
     */
    async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
        const mode = request.model || 'fast';
        const { client, deployment, modelName } = this.getClient(mode);

        console.log(`🤖 Using ${modelName} for streaming chat...`);

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
    }

    /**
     * Get available models info
     */
    getAvailableModels(): { name: string; available: boolean }[] {
        return [
            { name: 'o4-mini', available: !!this.o4MiniClient },
            { name: 'Phi-4-reasoning', available: !!this.phi4Client },
        ];
    }

    /**
     * Check if provider is ready
     */
    isReady(): boolean {
        return !!(this.o4MiniClient || this.phi4Client);
    }
}

// ============================================
// Singleton instance for API routes
// ============================================

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
    if (!providerInstance) {
        providerInstance = new AIProvider();
    }
    return providerInstance;
}
