/**
 * useAutoSaveConversation Hook
 * Automatically saves conversations when chat is complete
 */

import { useEffect, useRef } from 'react';
import { useMemory } from '../contexts/MemoryContext';
import { MemoryService, ConversationMessage } from '../services/MemoryService';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Hook to auto-save conversation when chat completes
 * 
 * @param messages - Current chat messages
 * @param isComplete - Whether the current response is complete
 */
export function useAutoSaveConversation(
    messages: ChatMessage[],
    isComplete: boolean
) {
    const { anonymousId, preferences } = useMemory();
    const savedRef = useRef(false);
    const lastMessageCountRef = useRef(0);

    useEffect(() => {
        // Skip if memory disabled or no user ID
        if (!preferences.memoryEnabled || !anonymousId) return;

        // Skip if not complete or no messages
        if (!isComplete || messages.length === 0) return;

        // Skip if already saved for this conversation length
        if (savedRef.current && lastMessageCountRef.current === messages.length) return;

        // Only save if we have at least one user and one assistant message
        const hasUserMessage = messages.some(m => m.role === 'user');
        const hasAssistantMessage = messages.some(m => m.role === 'assistant' && m.content.trim());

        if (!hasUserMessage || !hasAssistantMessage) return;

        // Convert to ConversationMessage format
        const conversationMessages: ConversationMessage[] = messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: new Date(),
        }));

        // Save conversation
        MemoryService.saveConversation(anonymousId, conversationMessages)
            .then((id) => {
                if (id) {
                    savedRef.current = true;
                    lastMessageCountRef.current = messages.length;
                }
            })
            .catch(console.error);

    }, [messages, isComplete, anonymousId, preferences.memoryEnabled]);

    // Reset saved flag when new conversation starts
    useEffect(() => {
        if (messages.length < lastMessageCountRef.current) {
            savedRef.current = false;
            lastMessageCountRef.current = 0;
        }
    }, [messages.length]);
}

export default useAutoSaveConversation;
