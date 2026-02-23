interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export class ChatService {
    constructor() {}

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal; sessionId?: string },
    ): Promise<void> {
        console.log("📨 Chat request sent to backend");

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (options?.sessionId) {
                headers['x-session-id'] = options.sessionId;
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    messages,
                    stream: true,
                    model: 'fast' // The backend handles fallback, so 'fast' is a good default
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || `Chat request failed: ${response.status}`);
            }

            if (!response.body) {
                throw new Error('No response body received');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // SSE messages are separated by double newline
                const lines = buffer.split('\n\n');

                // Keep the last part in buffer if it's incomplete
                // If the last part was empty (meaning buffer ended with \n\n), pop returns empty string
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
                        continue;
                    }

                    const data = trimmedLine.slice(6);

                    if (data === '[DONE]') {
                        return;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        onContent(parsed.content, parsed.done);
                    } catch (e) {
                        console.warn('Failed to parse SSE data:', e);
                    }
                }
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Chat request aborted');
                return;
            }
            console.error('Chat service error:', error);
            throw error;
        }
    }

    // Helper for non-streaming requests if needed
    async sendMessage(messages: ChatMessage[]): Promise<string> {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages,
                stream: false,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || `Chat request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.content;
    }
}
