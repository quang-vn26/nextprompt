import { ChatMessage } from "../types";

export class ChatService {
    constructor() {
        // No client initialization needed - using backend API
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.log("📨 Chat request to backend");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': 'user-session', // simplified for now
                },
                body: JSON.stringify({
                    messages,
                    stream: true,
                    model: 'fast', // or make this configurable
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch chat response');
            }

            if (!response.body) {
                throw new Error("Response body is empty");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Process SSE messages
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content !== undefined) {
                                onContent(parsed.content, parsed.done);
                            }
                        } catch (e) {
                            console.warn("Failed to parse SSE data:", e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Chat service error:", error);
            throw error;
        }
    }

    // Non-streaming method
    async sendMessage(messages: ChatMessage[]): Promise<string> {
        console.log("📨 Send message request to backend");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': 'user-session',
                },
                body: JSON.stringify({
                    messages,
                    stream: false,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch chat response');
            }

            const data = await response.json();
            return data.content;
        } catch (error) {
            console.error("Chat service error:", error);
            throw error;
        }
    }
}
