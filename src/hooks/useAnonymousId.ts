/**
 * useAnonymousId Hook
 * Manages anonymous user identification for the memory system
 */

import { useState, useEffect } from 'react';

const ANONYMOUS_ID_KEY = 'nextprompt_anonymous_id';

/**
 * Generate a UUID v4 compatible ID
 */
function generateAnonymousId(): string {
    // Use crypto API if available, fallback to Math.random
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Get or create anonymous ID from localStorage
 */
function getOrCreateAnonymousId(): string {
    // Check localStorage
    const stored = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (stored) {
        return stored;
    }

    // Generate new ID
    const newId = generateAnonymousId();
    localStorage.setItem(ANONYMOUS_ID_KEY, newId);

    return newId;
}

export interface UseAnonymousIdResult {
    anonymousId: string | null;
    isLoading: boolean;
    isNewUser: boolean;
    clearId: () => void;
}

/**
 * Hook to manage anonymous user ID
 * 
 * @returns Object with anonymousId, loading state, new user flag, and clear function
 */
export function useAnonymousId(): UseAnonymousIdResult {
    const [anonymousId, setAnonymousId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isNewUser, setIsNewUser] = useState(false);

    useEffect(() => {
        // Check if we're in browser
        if (typeof window === 'undefined') {
            setIsLoading(false);
            return;
        }

        try {
            // Check if ID exists
            const existingId = localStorage.getItem(ANONYMOUS_ID_KEY);
            const wasNewUser = !existingId;

            // Get or create ID
            const id = getOrCreateAnonymousId();

            setAnonymousId(id);
            setIsNewUser(wasNewUser);

            // Sync with backend (fire and forget)
            if (wasNewUser) {
                syncUserWithBackend(id).catch(console.error);
            }
        } catch (error) {
            console.error('Failed to get anonymous ID:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearId = () => {
        localStorage.removeItem(ANONYMOUS_ID_KEY);
        setAnonymousId(null);
        setIsNewUser(true);
    };

    return { anonymousId, isLoading, isNewUser, clearId };
}

/**
 * Sync anonymous user with backend
 */
async function syncUserWithBackend(anonymousId: string): Promise<void> {
    try {
        const response = await fetch('/api/memory/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anonymousId }),
        });

        if (!response.ok) {
            console.warn('Failed to sync user with backend');
        }
    } catch (error) {
        // Silently fail - memory works locally even if backend fails
        console.warn('Backend sync failed:', error);
    }
}

export default useAnonymousId;
