export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export class ChatService {
    private sessionId: string = "anonymous";

    constructor(sessionId?: string) {
        if (sessionId) {
            this.sessionId = sessionId;
        }
    }

    setSessionId(sessionId: string) {
        this.sessionId = sessionId;
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.log("📨 Chat request (stream) via backend API");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': this.sessionId
                },
                body: JSON.stringify({
                    messages,
                    stream: true,
                    model: 'fast' // Optional, could make it configurable
                }),
                signal: options?.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || `HTTP error ${response.status}`);
            }

            if (!response.body) {
                throw new Error("No response body available");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                if (options?.signal?.aborted) {
                    reader.cancel();
                    throw new Error("Request aborted");
                }

                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunkStr = decoder.decode(value, { stream: true });
                const lines = chunkStr.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);

                        if (dataStr === '[DONE]') {
                            break;
                        }

                        try {
                            const data = JSON.parse(dataStr);
                            onContent(data.content, data.done);
                        } catch (e) {
                            console.warn("Error parsing chunk", e, dataStr);
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error("❌ Chat API error:", error);
            throw error;
        }
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        console.log("📨 Chat request (non-stream) via backend API");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': this.sessionId
                },
                body: JSON.stringify({
                    messages,
                    stream: false,
                    model: 'fast'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || `HTTP error ${response.status}`);
            }

            const data = await response.json();
            return data.content || "";
        } catch (error) {
            console.error("❌ Chat API error:", error);
            throw error;
        }
    }
}
