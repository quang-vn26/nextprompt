/**
 * Type definitions for AI Provider system
 */

// ============================================
// AI Provider Types
// ============================================

export type AIModelType =
    | 'o4-mini'
    | 'phi4-reasoning'
    | 'gemini-flash'
    | 'deepseek-v3'
    | 'deepseek-r1'
    | 'openai-gpt4';

export type ChatMode = 'fast' | 'deep';

export interface AIProviderConfig {
    name: string;
    endpoint: string;
    apiKey: string;
    deployment: string;
    temperature?: number;
    maxTokens?: number;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatRequest {
    messages: ChatMessage[];
    model?: ChatMode;
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
}

export interface ChatResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface StreamChunk {
    content: string;
    done: boolean;
}

// ============================================
// MongoDB Types
// ============================================

export interface SettingsDocument {
    _id?: string;
    key: 'ai_config' | 'app_settings' | 'usage_limits';
    value: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface AIConfigSettings {
    defaultModel: ChatMode;
    temperature: number;
    maxTokens: number;
    enableFallback: boolean;
}

export interface UsageLogDocument {
    _id?: string;
    sessionId: string;
    model: AIModelType;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    timestamp: Date;
}
