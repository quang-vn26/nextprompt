export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface StreamOptions {
    signal?: AbortSignal;
}

export interface LLMProvider {
    name: string;
    streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: StreamOptions
    ): Promise<void>;

    sendMessage(
        messages: ChatMessage[]
    ): Promise<string>;
}
