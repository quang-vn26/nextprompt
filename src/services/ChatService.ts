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
        console.log("📨 Chat request (via backend)");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages,
                    stream: true,
                    model: 'fast', // Let backend handle fallback chain starting with fast model
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Chat request failed: ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error("No response body");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');

                // Keep the last partial line in the buffer
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            // End of stream
                            onContent(accumulatedContent, true);
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            // Backend now sends deltas
                            if (parsed.content) {
                                accumulatedContent += parsed.content;
                                onContent(accumulatedContent, false);
                            }
                        } catch (e) {
                            console.warn("Failed to parse chunk:", e);
                        }
                    }
                }
            }

            // Handle any remaining buffer if needed, usually empty or newline
            if (buffer.trim() !== '' && buffer.startsWith('data: ')) {
                 try {
                    const data = buffer.slice(6);
                    if (data !== '[DONE]') {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            accumulatedContent += parsed.content;
                            onContent(accumulatedContent, false);
                        }
                    }
                 } catch (e) {
                     // ignore
                 }
            }

            onContent(accumulatedContent, true);
            console.log("✅ Chat response completed");

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log("Chat request aborted");
                throw error;
            }
            console.error("❌ Chat request failed:", error);
            throw error;
        }
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        console.log("📨 Send message (via backend)");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages,
                    stream: false,
                    model: 'fast',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Request failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.content || "";

        } catch (error) {
            console.error("❌ Send message failed:", error);
            throw error;
        }
    }
}
