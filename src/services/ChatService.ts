interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

// Optimized retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 5000;

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class ChatService {
    private sessionId: string;

    constructor() {
        this.sessionId = this.getOrCreateSessionId();
    }

    private getOrCreateSessionId(): string {
        const STORAGE_KEY = 'chat_session_id';
        let sessionId = '';
        if (typeof window !== 'undefined') {
            sessionId = localStorage.getItem(STORAGE_KEY) || '';
            if (!sessionId) {
                sessionId = crypto.randomUUID();
                localStorage.setItem(STORAGE_KEY, sessionId);
            }
        } else {
            sessionId = 'server-side-session';
        }
        return sessionId;
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.log("📨 Chat request (Streaming)");
        const formattedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));

        let attempt = 0;
        while (attempt < MAX_RETRIES) {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-session-id': this.sessionId,
                    },
                    body: JSON.stringify({
                        messages: formattedMessages,
                        model: 'fast', // Default to fast, backend handles routing
                        stream: true,
                    }),
                    signal: options?.signal,
                });

                if (response.status === 429) {
                    throw new Error('Rate limit exceeded');
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                }

                if (!response.body) {
                    throw new Error('No response body');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let accumulatedContent = '';
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    const lines = buffer.split('\n');

                    // Keep the last line in the buffer as it might be incomplete
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') continue;

                            try {
                                const data = JSON.parse(dataStr);
                                if (data.content) {
                                    // Backend sends deltas, so we accumulate
                                    accumulatedContent += data.content;
                                    const cleanContent = this.stripThinkingTags(accumulatedContent);
                                    if (cleanContent) {
                                        onContent(cleanContent, false);
                                    }
                                }
                            } catch (e) {
                                console.warn('Error parsing SSE data:', e);
                            }
                        }
                    }
                }

                const finalContent = this.stripThinkingTags(accumulatedContent);
                onContent(finalContent, true);
                console.log("✅ Chat response completed");
                return;

            } catch (error: any) {
                if (error.name === 'AbortError') throw error;

                attempt++;
                console.warn(`⚠️ Chat attempt ${attempt} failed:`, error);

                if (attempt >= MAX_RETRIES) throw error;

                // Exponential backoff
                const waitTime = Math.min(INITIAL_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
                await delay(waitTime);
            }
        }
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        console.log("📨 Chat request (Non-streaming)");
        const formattedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': this.sessionId,
            },
            body: JSON.stringify({
                messages: formattedMessages,
                model: 'fast',
                stream: false,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        return data.content || '';
    }

    // Helper to strip <think> tags if they appear
    private stripThinkingTags(content: string): string {
        // Remove <think>...</think> blocks (including everything inside)
        let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
        // Also handle case where </think> hasn't arrived yet (streaming)
        cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
        // Clean up extra whitespace
        return cleaned.trim();
    }
}
