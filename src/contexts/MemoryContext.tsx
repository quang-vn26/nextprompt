/**
 * Memory Context
 * Provides memory state and operations throughout the app
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAnonymousId } from '../hooks/useAnonymousId';

// Types
export interface Conversation {
    _id: string;
    title: string;
    summary?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
    entities: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface UserPreferences {
    displayName?: string;
    language: 'vi' | 'en';
    theme: 'dark' | 'light';
    memoryEnabled: boolean;
}

export interface MemoryContextType {
    // User
    anonymousId: string | null;
    isLoading: boolean;
    preferences: UserPreferences;

    // Conversations
    conversations: Conversation[];

    // Actions
    saveConversation: (title: string, messages: Conversation['messages']) => Promise<string | null>;
    deleteConversation: (id: string) => Promise<boolean>;
    refreshConversations: () => Promise<void>;
    updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
    getMemoryContext: () => string;
}

const defaultPreferences: UserPreferences = {
    language: 'vi',
    theme: 'dark',
    memoryEnabled: true,
};

const MemoryContext = createContext<MemoryContextType | null>(null);

export function MemoryProvider({ children }: { children: ReactNode }) {
    const { anonymousId, isLoading: isIdLoading } = useAnonymousId();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch conversations when user ID is ready
    useEffect(() => {
        if (anonymousId && !isIdLoading) {
            refreshConversations();
        } else if (!isIdLoading) {
            setIsLoading(false);
        }
    }, [anonymousId, isIdLoading]);

    const refreshConversations = useCallback(async () => {
        if (!anonymousId) return;

        try {
            setIsLoading(true);
            const response = await fetch(`/api/memory/conversations?userId=${anonymousId}`);
            if (response.ok) {
                const text = await response.text();
                // Only parse if it looks like JSON
                if (text.startsWith('{') || text.startsWith('[')) {
                    const data = JSON.parse(text);
                    setConversations(data.conversations || []);
                }
            }
        } catch (error) {
            // Silently fail - memory is optional feature
            console.warn('Memory API not available:', error);
        } finally {
            setIsLoading(false);
        }
    }, [anonymousId]);

    const saveConversation = useCallback(async (
        title: string,
        messages: Conversation['messages']
    ): Promise<string | null> => {
        if (!anonymousId || !preferences.memoryEnabled) return null;

        try {
            const response = await fetch('/api/memory/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: anonymousId,
                    title,
                    messages,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                await refreshConversations();
                return data.id;
            }
        } catch (error) {
            console.error('Failed to save conversation:', error);
        }
        return null;
    }, [anonymousId, preferences.memoryEnabled, refreshConversations]);

    const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
        if (!anonymousId) return false;

        try {
            const response = await fetch(`/api/memory/conversations/${id}?userId=${anonymousId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setConversations(prev => prev.filter(c => c._id !== id));
                return true;
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
        }
        return false;
    }, [anonymousId]);

    const updatePreferences = useCallback(async (prefs: Partial<UserPreferences>) => {
        setPreferences(prev => ({ ...prev, ...prefs }));

        if (anonymousId) {
            try {
                await fetch('/api/memory/preferences', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: anonymousId, preferences: prefs }),
                });
            } catch (error) {
                console.error('Failed to update preferences:', error);
            }
        }
    }, [anonymousId]);

    // Generate memory context for AI prompt injection
    const getMemoryContext = useCallback((): string => {
        if (!preferences.memoryEnabled || conversations.length === 0) {
            return '';
        }

        const recentConversations = conversations.slice(0, 3);
        const contextParts: string[] = [];

        if (recentConversations.length > 0) {
            contextParts.push('Recent conversation topics:');
            recentConversations.forEach((conv, i) => {
                contextParts.push(`${i + 1}. ${conv.title}${conv.summary ? ` - ${conv.summary}` : ''}`);
            });
        }

        if (preferences.displayName) {
            contextParts.push(`User prefers to be called: ${preferences.displayName}`);
        }

        return contextParts.join('\n');
    }, [conversations, preferences]);

    const value: MemoryContextType = {
        anonymousId,
        isLoading: isLoading || isIdLoading,
        preferences,
        conversations,
        saveConversation,
        deleteConversation,
        refreshConversations,
        updatePreferences,
        getMemoryContext,
    };

    return (
        <MemoryContext.Provider value={value}>
            {children}
        </MemoryContext.Provider>
    );
}

export function useMemory(): MemoryContextType {
    const context = useContext(MemoryContext);
    if (!context) {
        throw new Error('useMemory must be used within a MemoryProvider');
    }
    return context;
}

export default MemoryContext;
