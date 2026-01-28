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
        console.log("📨 Chat request (via Backend)");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages,
                    stream: true,
                    model: 'deep', // Default to deep/reasoning model (Phi-4)
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
            }

            if (!response.body) {
                throw new Error('Response body is empty');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accumulatedContent = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith('data: ')) continue;

                    const data = line.slice(6);

                    if (data === '[DONE]') {
                        onContent(accumulatedContent, true);
                        return;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content !== undefined) {
                            accumulatedContent = parsed.content;
                            onContent(accumulatedContent, false);
                        }
                    } catch (e) {
                        console.warn('Failed to parse SSE message:', e);
                    }
                }
            }

            // Ensure we finish if [DONE] wasn't received (e.g. connection closed)
            onContent(accumulatedContent, true);

        } catch (error: any) {
            console.error("❌ ChatService error:", error);
            if (error.name === 'AbortError') {
                throw error;
            }
            throw new Error(`Chat service failed: ${error.message}`);
        }
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        console.log("📨 sendMessage request (via Backend)");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages,
                    stream: false,
                    model: 'fast', // Use fast model for single completions usually
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
            }

            const data = await response.json();
            return data.content || "";

        } catch (error: any) {
            console.error("❌ sendMessage error:", error);
            throw error;
        }
    }
}
