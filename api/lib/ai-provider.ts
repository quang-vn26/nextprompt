/**
 * AI Provider Module
 * Unified interface for Azure OpenAI (o4-mini), Azure AI (Phi-4-reasoning), and Google Gemini
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
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

// Google Gemini Config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

// ============================================
// AI Provider Class
// ============================================

export class AIProvider {
    private o4MiniClient: OpenAI | null = null;
    private phi4Client: OpenAI | null = null;
    private geminiClient: GoogleGenerativeAI | null = null;
    private geminiModel: GenerativeModel | null = null;

    constructor() {
        this.initializeClients();
    }

    /**
     * Initialize AI clients
     */
    private initializeClients(): void {
        // Initialize o4-mini client
        if (AZURE_OPENAI_CONFIG.apiKey && AZURE_OPENAI_CONFIG.endpoint) {
            this.o4MiniClient = new OpenAI({
                baseURL: AZURE_OPENAI_CONFIG.endpoint,
                apiKey: AZURE_OPENAI_CONFIG.apiKey,
            });
            console.log('✅ Azure OpenAI (o4-mini) client initialized');
        } else {
            console.warn('⚠️ Azure OpenAI API key/endpoint not configured');
        }

        // Initialize Phi-4 client
        if (AZURE_PHI4_CONFIG.apiKey && AZURE_PHI4_CONFIG.endpoint) {
            this.phi4Client = new OpenAI({
                baseURL: AZURE_PHI4_CONFIG.endpoint,
                apiKey: AZURE_PHI4_CONFIG.apiKey,
            });
            console.log('✅ Azure AI (Phi-4-reasoning) client initialized');
        } else {
            console.warn('⚠️ Azure Phi-4 API key/endpoint not configured');
        }

        // Initialize Gemini client
        if (GEMINI_API_KEY) {
            this.geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
            this.geminiModel = this.geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
            console.log('✅ Google Gemini client initialized');
        } else {
            console.warn('⚠️ Google Gemini API key not configured');
        }
    }

    /**
     * Get appropriate OpenAI client based on mode
     */
    private getOpenAIClient(mode: ChatMode): { client: OpenAI; deployment: string; modelName: string } | null {
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
        return null;
    }

    /**
     * Send chat completion request (non-streaming)
     */
    async chatCompletion(request: ChatRequest, sessionId: string): Promise<ChatResponse> {
        const mode = request.model || 'fast';
        const openAIProvider = this.getOpenAIClient(mode);

        if (openAIProvider) {
            return this.chatCompletionOpenAI(openAIProvider, request, sessionId);
        } else if (this.geminiModel) {
            return this.chatCompletionGemini(request, sessionId);
        }

        throw new Error('No AI provider available. Please check your API keys.');
    }

    private async chatCompletionOpenAI(
        provider: { client: OpenAI; deployment: string; modelName: string },
        request: ChatRequest,
        sessionId: string
    ): Promise<ChatResponse> {
        const { client, deployment, modelName } = provider;
        console.log(`🤖 Using ${modelName} for chat completion (Session: ${sessionId})...`);

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
                sessionId,
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

    private async chatCompletionGemini(request: ChatRequest, sessionId: string): Promise<ChatResponse> {
        if (!this.geminiModel) throw new Error('Gemini not initialized');
        console.log(`🤖 Using Gemini for chat completion (Session: ${sessionId})...`);

        const history = request.messages.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

        const lastMessage = request.messages[request.messages.length - 1].content;

        const chat = this.geminiModel.startChat({
            history: history,
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 2048,
            },
        });

        const result = await chat.sendMessage(lastMessage);
        const response = result.response;
        const text = response.text();

        // Estimate usage (Gemini doesn't always provide it in the same format, simplified here)
        // Ideally we would count tokens
        const estimatedPromptTokens = lastMessage.length / 4;
        const estimatedCompletionTokens = text.length / 4;

        await logUsage(
            sessionId,
            'gemini-1.5-flash',
            Math.ceil(estimatedPromptTokens),
            Math.ceil(estimatedCompletionTokens)
        );

        return {
            content: text,
            model: 'gemini-1.5-flash',
            usage: {
                promptTokens: Math.ceil(estimatedPromptTokens),
                completionTokens: Math.ceil(estimatedCompletionTokens),
                totalTokens: Math.ceil(estimatedPromptTokens + estimatedCompletionTokens),
            }
        };
    }

    /**
     * Stream chat completion with generator
     */
    async *streamChat(request: ChatRequest, sessionId: string): AsyncGenerator<StreamChunk> {
        const mode = request.model || 'fast';
        const openAIProvider = this.getOpenAIClient(mode);

        if (openAIProvider) {
            yield* this.streamChatOpenAI(openAIProvider, request, sessionId);
        } else if (this.geminiModel) {
            yield* this.streamChatGemini(request, sessionId);
        } else {
            throw new Error('No AI provider available. Please check your API keys.');
        }
    }

    private async *streamChatOpenAI(
        provider: { client: OpenAI; deployment: string; modelName: string },
        request: ChatRequest,
        sessionId: string
    ): AsyncGenerator<StreamChunk> {
        const { client, deployment, modelName } = provider;
        console.log(`🤖 Using ${modelName} for streaming chat (Session: ${sessionId})...`);

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
            if (delta) {
                yield {
                    content: delta,
                    done: false,
                };
            }
        }

        yield {
            content: '',
            done: true,
        };
    }

    private async *streamChatGemini(request: ChatRequest, sessionId: string): AsyncGenerator<StreamChunk> {
        if (!this.geminiModel) throw new Error('Gemini not initialized');
        console.log(`🤖 Using Gemini for streaming chat (Session: ${sessionId})...`);

        const history = request.messages.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

        const lastMessage = request.messages[request.messages.length - 1].content;

        const chat = this.geminiModel.startChat({
            history: history,
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 2048,
            },
        });

        const result = await chat.sendMessageStream(lastMessage);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                yield {
                    content: chunkText,
                    done: false,
                };
            }
        }

        yield {
            content: '',
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
            { name: 'gemini-1.5-flash', available: !!this.geminiModel },
        ];
    }

    /**
     * Check if provider is ready
     */
    isReady(): boolean {
        return !!(this.o4MiniClient || this.phi4Client || this.geminiModel);
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
