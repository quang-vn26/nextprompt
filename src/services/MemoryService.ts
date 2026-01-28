/**
 * Memory Service
 * Frontend service for managing conversation memory
 */

// Types matching MemoryContext
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface SavedConversation {
    _id: string;
    userId: string;
    title: string;
    summary?: string;
    messages: ConversationMessage[];
    entities: string[];
    createdAt: Date;
    updatedAt: Date;
}

export class MemoryService {
    /**
     * Generate a title from the first user message
     */
    static generateTitle(messages: ConversationMessage[]): string {
        const firstUserMessage = messages.find(m => m.role === 'user');
        if (!firstUserMessage) return 'New Conversation';

        // Truncate to first 50 chars
        const content = firstUserMessage.content.trim();
        if (content.length <= 50) return content;
        return content.substring(0, 47) + '...';
    }

    /**
     * Extract entities from conversation (simple keyword extraction)
     */
    static extractEntities(messages: ConversationMessage[]): string[] {
        const entities = new Set<string>();

        // Simple patterns for common entities
        const patterns = [
            /project\s+([A-Z][a-zA-Z0-9_-]+)/gi,  // Project names
            /app\s+([A-Z][a-zA-Z0-9_-]+)/gi,       // App names
            /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,   // Proper nouns
        ];

        messages.forEach(msg => {
            patterns.forEach(pattern => {
                const matches = msg.content.matchAll(pattern);
                for (const match of matches) {
                    if (match[1] && match[1].length > 2) {
                        entities.add(match[1]);
                    }
                }
            });
        });

        return Array.from(entities).slice(0, 10); // Max 10 entities
    }

    /**
     * Save conversation to backend
     */
    static async saveConversation(
        userId: string,
        messages: ConversationMessage[],
        customTitle?: string
    ): Promise<string | null> {
        if (!userId || messages.length === 0) return null;

        try {
            const title = customTitle || this.generateTitle(messages);
            const entities = this.extractEntities(messages);

            const response = await fetch('/api/memory/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    title,
                    messages: messages.map(m => ({
                        ...m,
                        timestamp: m.timestamp || new Date(),
                    })),
                    entities,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('💾 Conversation saved:', title);
                return data.id;
            }
        } catch (error) {
            console.error('Failed to save conversation:', error);
        }
        return null;
    }

    /**
     * Get recent conversations
     */
    static async getRecentConversations(
        userId: string,
        limit: number = 10
    ): Promise<SavedConversation[]> {
        try {
            const response = await fetch(
                `/api/memory/conversations?userId=${userId}&limit=${limit}`
            );
            if (response.ok) {
                const data = await response.json();
                return data.conversations || [];
            }
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        }
        return [];
    }

    /**
     * Delete a conversation
     */
    static async deleteConversation(
        userId: string,
        conversationId: string
    ): Promise<boolean> {
        try {
            const response = await fetch(
                `/api/memory/conversations/${conversationId}?userId=${userId}`,
                { method: 'DELETE' }
            );
            return response.ok;
        } catch (error) {
            console.error('Failed to delete conversation:', error);
        }
        return false;
    }

    /**
     * Generate memory context for AI prompt injection
     */
    static generateContextPrompt(conversations: SavedConversation[]): string {
        if (conversations.length === 0) return '';

        const recent = conversations.slice(0, 3);
        const lines: string[] = [
            '\n[Memory Context]',
            'Recent topics discussed:',
        ];

        recent.forEach((conv, i) => {
            const date = new Date(conv.createdAt).toLocaleDateString();
            lines.push(`${i + 1}. "${conv.title}" (${date})`);
        });

        return lines.join('\n');
    }
}

export default MemoryService;
