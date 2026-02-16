interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export class ChatService {
    constructor() {}

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': this.getSessionId(),
                },
                body: JSON.stringify({
                    messages,
                    stream: true,
                    // The backend handles the fallback chain regardless of model param for now
                    model: 'fast',
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Chat API error: ${response.status} ${response.statusText}`);
            }

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            continue;
                        }

                        try {
                            const chunk = JSON.parse(data);
                            // chunk is { content: string, done: boolean }
                            // content is accumulated text
                            if (chunk.content !== undefined) {
                                onContent(chunk.content, chunk.done);
                            }
                        } catch (e) {
                            console.warn('Error parsing SSE data:', e);
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('Chat stream error:', error);
            throw error;
        }
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': this.getSessionId(),
                },
                body: JSON.stringify({
                    messages,
                    stream: false,
                    model: 'fast',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Chat API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.content;
        } catch (error) {
            console.error('Chat message error:', error);
            throw error;
        }
    }

    private getSessionId(): string {
        // Simple session ID persistence
        let sessionId = localStorage.getItem('promptions_session_id');
        if (!sessionId) {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                sessionId = crypto.randomUUID();
            } else {
                // Fallback for older browsers
                sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            }
            localStorage.setItem('promptions_session_id', sessionId);
        }
        return sessionId;
    }
}
