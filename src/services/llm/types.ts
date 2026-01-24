export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface IChatProvider {
    name: string;
    streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal }
    ): Promise<void>;

    sendMessage(messages: ChatMessage[]): Promise<string>;
}
