/**
 * useMemoryInjectedChat Hook
 * Injects memory context into chat system prompts
 */

import { useMemo } from 'react';
import { useMemory } from '../contexts/MemoryContext';
import { MemoryService } from '../services/MemoryService';

const BASE_SYSTEM_PROMPT = `You are a helpful AI chat bot. When responding to a user consider whether they have provided any additional settings or selections. If they have, do not ask them extra follow-up questions but continue with their intent based on the context.`;

/**
 * Hook to get system prompt with memory context injected
 */
export function useMemoryInjectedPrompt() {
    const { conversations, preferences, anonymousId } = useMemory();

    const systemPrompt = useMemo(() => {
        if (!preferences.memoryEnabled || conversations.length === 0) {
            return BASE_SYSTEM_PROMPT;
        }

        const memoryContext = MemoryService.generateContextPrompt(
            conversations.map(c => ({
                _id: c._id,
                userId: anonymousId || '',
                title: c.title,
                summary: c.summary,
                entities: c.entities,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt),
                messages: c.messages.map(m => ({
                    ...m,
                    timestamp: new Date(m.timestamp),
                })),
            }))
        );

        if (!memoryContext) {
            return BASE_SYSTEM_PROMPT;
        }

        return `${BASE_SYSTEM_PROMPT}
${memoryContext}

Use this context to provide more personalized and contextual responses.`;
    }, [conversations, preferences.memoryEnabled]);

    return {
        systemPrompt,
        hasMemoryContext: conversations.length > 0 && preferences.memoryEnabled,
        anonymousId,
    };
}

/**
 * Get the base system prompt (for imports elsewhere)
 */
export const getBaseSystemPrompt = () => BASE_SYSTEM_PROMPT;

export default useMemoryInjectedPrompt;
