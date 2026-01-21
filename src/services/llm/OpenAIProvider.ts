import OpenAI from "openai";
import { ChatMessage, LLMProvider, StreamOptions } from "./types";

export class OpenAIProvider implements LLMProvider {
    name = "OpenAI";
    private openai: OpenAI;
    private modelName = "gpt-4.1-mini";

    constructor(apiKey: string) {
        // SECURITY WARNING: Using allowBrowser: true is not safe for production
        // API keys should be handled on the backend.
        this.openai = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true,
        });
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: StreamOptions
    ): Promise<void> {
        const openaiMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const stream = await this.openai.chat.completions.create({
            model: this.modelName,
            messages: openaiMessages,
            stream: true,
            temperature: 0.7,
            max_tokens: 2048,
        });

        let accumulatedContent = "";

        for await (const chunk of stream) {
            if (options?.signal?.aborted) {
                throw new Error("Request aborted");
            }
            const delta = chunk.choices[0]?.delta?.content || "";
            accumulatedContent += delta;
            onContent(accumulatedContent, false);
        }

        onContent(accumulatedContent, true);
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        const openaiMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const response = await this.openai.chat.completions.create({
            model: this.modelName,
            messages: openaiMessages,
            temperature: 0.7,
            max_tokens: 2048,
        });

        return response.choices[0]?.message?.content || "";
    }
}
