import OpenAI from "openai";
import { IChatProvider, ChatMessage } from "./types";
import { config } from "../../config";

export class OpenAIProvider implements IChatProvider {
    name = "OpenAI";
    private openai: OpenAI;

    constructor() {
        // WARNING: This exposes the API key to the client.
        // In a production environment, requests should be proxied through a backend.
        this.openai = new OpenAI({
            apiKey: config.openai.apiKey || "",
            dangerouslyAllowBrowser: true,
        });
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        options?: { signal?: AbortSignal }
    ): Promise<void> {
        const openaiMessages = messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));

        const stream = await this.openai.chat.completions.create({
            model: config.openai.model,
            messages: openaiMessages,
            stream: true,
            ...config.openai.defaults
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
            model: config.openai.model,
            messages: openaiMessages,
            ...config.openai.defaults
        });

        return response.choices[0]?.message?.content || "";
    }
}
