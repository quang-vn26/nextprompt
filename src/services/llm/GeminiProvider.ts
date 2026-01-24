import { GoogleGenerativeAI } from "@google/generative-ai";
import { IChatProvider, ChatMessage } from "./types";
import { config } from "../../config";

export class GeminiProvider implements IChatProvider {
    name = "Gemini";
    private genAI: GoogleGenerativeAI;
    private defaultModel: any;

    constructor() {
        this.genAI = new GoogleGenerativeAI(config.gemini.apiKey || "");
        if (config.gemini.apiKey) {
            this.defaultModel = this.genAI.getGenerativeModel({
                model: config.gemini.model,
                generationConfig: config.gemini.generationConfig,
            });
        }
    }

    private getModel(systemInstruction?: string) {
        if (!config.gemini.apiKey) {
            throw new Error("Gemini API key not configured");
        }
        if (systemInstruction) {
            return this.genAI.getGenerativeModel({
                model: config.gemini.model,
                systemInstruction: systemInstruction,
                generationConfig: config.gemini.generationConfig,
            });
        }
        return this.defaultModel;
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        _options?: { signal?: AbortSignal }
    ): Promise<void> {
        // Convert history to Gemini format (excluding the last message which is the latest prompt)
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        const systemMsg = messages.find(m => m.role === "system");
        const model = this.getModel(systemMsg?.content);

        const chat = model.startChat({
            history: history.filter(h => h.role !== "system"),
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
         const systemMsg = messages.find(m => m.role === "system");
         const model = this.getModel(systemMsg?.content);

         const lastMessage = messages[messages.length - 1].content;
         // Note: For simple generation without history, we might just pass the prompt.
         // But here we are assuming messages might contain history?
         // The original sendMessage implementation just took the last message.
         // "const lastMessage = messages[messages.length - 1].content;"
         // "const result = await this.model.generateContent(lastMessage);"
         // It ignored history in sendMessage! I will preserve this behavior but it seems buggy if history matters.
         // However, looking at usage, it might be single-shot.

         const result = await model.generateContent(lastMessage);
         const response = await result.response;
         return response.text();
    }
}
