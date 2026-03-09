export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export class ChatService {
    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal, model?: string },
    ): Promise<void> {
        try {
            const sessionId = localStorage.getItem("anonymousId") || "anonymous";

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-id": sessionId,
                },
                body: JSON.stringify({
                    messages,
                    model: options?.model || "fast",
                    stream: true,
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            if (!response.body) {
                throw new Error("No response body");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                // Keep the last partial line in the buffer
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();

                        if (data === '[DONE]') {
                            onContent("", true);
                            return;
                        }

                        if (data) {
                            try {
                                const chunk = JSON.parse(data);
                                if (chunk.content !== undefined) {
                                    // The backend sends the full accumulated content in chunk.content
                                    onContent(chunk.content, chunk.done || false);
                                    if (chunk.done) {
                                        return;
                                    }
                                }
                            } catch (e) {
                                console.warn("Failed to parse chunk:", data, e);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Chat streaming error:", error);
            throw error;
        }
    }

    async sendMessage(messages: ChatMessage[], model: string = "fast"): Promise<string> {
        try {
            const sessionId = localStorage.getItem("anonymousId") || "anonymous";

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-id": sessionId,
                },
                body: JSON.stringify({
                    messages,
                    model,
                    stream: false,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.content;
        } catch (error) {
            console.error("Chat send error:", error);
            throw error;
        }
    }
}
