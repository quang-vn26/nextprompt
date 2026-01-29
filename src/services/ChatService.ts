interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

interface StreamChunk {
    content: string;
    done: boolean;
}

// Strip <think>...</think> tags from reasoning models (DeepSeek-R1, etc.)
const stripThinkingTags = (content: string): string => {
    // Remove <think>...</think> blocks (including everything inside)
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Also handle case where </think> hasn't arrived yet (streaming)
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
    // Clean up extra whitespace
    return cleaned.trim();
};

export class ChatService {
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
                    'x-session-id': 'default' // Should ideally come from a session manager
                },
                body: JSON.stringify({
                    messages,
                    model: 'auto', // Use auto fallback
                    stream: true
                }),
                signal: options?.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
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

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n\n');
                // Keep the last part in buffer if it's incomplete (doesn't end with \n\n)
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') continue;

                        try {
                            const data: StreamChunk = JSON.parse(dataStr);
                            if (data.content) {
                                // Accumulate content from deltas
                                accumulatedContent += data.content;

                                // Strip thinking tags
                                const cleanContent = stripThinkingTags(accumulatedContent);

                                if (cleanContent) {
                                    onContent(cleanContent, false);
                                }
                            }
                        } catch (e) {
                            console.warn("Error parsing SSE data:", e);
                        }
                    }
                }
            }

            // Final flush
            const cleanContent = stripThinkingTags(accumulatedContent);
            onContent(cleanContent, true);
            console.log("✅ Chat response completed");

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log("🛑 Request aborted");
                return;
            }
            console.error("❌ Chat API failed:", error);
            throw error;
        }
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        console.log("📨 Chat request (via Backend - Non-streaming)");

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': 'default'
            },
            body: JSON.stringify({
                messages,
                model: 'auto',
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.content || "";
    }
}
