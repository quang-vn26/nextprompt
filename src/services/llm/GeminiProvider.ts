import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage, LLMProvider, StreamOptions } from "./types";

export class GeminiProvider implements LLMProvider {
    name = "Gemini";
    private genAI: GoogleGenerativeAI;
    private model: any;
    private modelName = "gemini-2.5-flash";

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
            }
        });
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        _options?: StreamOptions
    ): Promise<void> {
        // Handle system instruction if present
        const systemMsg = messages.find(m => m.role === "system");

        // Convert history to Gemini format (excluding the last message which is the latest prompt)
        // AND excluding system messages which are handled separately
        const history = messages.slice(0, -1)
            .filter(msg => msg.role !== "system")
            .map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            }));

        const activeModel = systemMsg
            ? this.genAI.getGenerativeModel({
                model: this.modelName,
                systemInstruction: systemMsg.content,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
            : this.model;

        const chat = activeModel.startChat({
            history: history,
        });

        const lastMessage = messages[messages.length - 1].content;
        const result = await chat.sendMessageStream(lastMessage);

        let accumulatedContent = "";

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            accumulatedContent += chunkText;
            onContent(accumulatedContent, false);
        }

        onContent(accumulatedContent, true);
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        // Handle system instruction if present
        const systemMsg = messages.find(m => m.role === "system");

        const history = messages.slice(0, -1)
            .filter(msg => msg.role !== "system")
            .map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            }));

        const activeModel = systemMsg
            ? this.genAI.getGenerativeModel({
                model: this.modelName,
                systemInstruction: systemMsg.content,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
            : this.model;

        const chat = activeModel.startChat({
            history: history,
        });

        const lastMessage = messages[messages.length - 1].content;
        const result = await chat.sendMessage(lastMessage);
        const response = await result.response;
        return response.text();
    }
}
