interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

// Strip <think>...</think> tags from reasoning models
const stripThinkingTags = (content: string): string => {
    // Remove <think>...</think> blocks (including everything inside)
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Also handle case where </think> hasn't arrived yet (streaming)
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
    // Clean up extra whitespace
    return cleaned.trim();
};

export class ChatService {
    constructor() {
        // No client-side initialization needed
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.log("📨 Chat request sent to backend");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Optional: Pass session ID if available in frontend state
                    // 'x-session-id': '...'
                },
                body: JSON.stringify({
                    messages,
                    stream: true,
                    model: 'fast' // This triggers the fallback chain in backend
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Request failed with status ${response.status}`);
            }

            if (!response.body) {
                throw new Error('No response body received');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accumulatedContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine.startsWith('data: ')) continue;

                    const data = trimmedLine.slice(6);
                    if (data === '[DONE]') {
                        // Backend signaled completion
                        onContent(stripThinkingTags(accumulatedContent), true);
                        return;
                    }

                    try {
                        const chunk = JSON.parse(data);
                        // chunk is { content: string (delta), done: boolean }
                        if (chunk.content) {
                            accumulatedContent += chunk.content;
                            const cleanContent = stripThinkingTags(accumulatedContent);
                            if (cleanContent) {
                                onContent(cleanContent, false);
                            }
                        }
                    } catch (e) {
                        console.warn('Error parsing stream chunk:', e);
                    }
                }
            }

            // Ensure final content is sent if loop finishes without [DONE]
            onContent(stripThinkingTags(accumulatedContent), true);

        } catch (error) {
            console.error("❌ ChatService error:", error);
            throw error;
        }
    }

    // Non-streaming method
    async sendMessage(messages: ChatMessage[]): Promise<string> {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages,
                    stream: false,
                    model: 'fast'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Request failed with status ${response.status}`);
            }

            const data = await response.json();
            // data is { content: string, model: string, usage: ... }
            return data.content;

        } catch (error) {
            console.error("ChatService sendMessage error:", error);
            throw error;
        }
    }
}
