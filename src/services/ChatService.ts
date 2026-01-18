import { GoogleGenerativeAI } from "@google/generative-ai";

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export class ChatService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error(
                "Gemini API key is required. Please set VITE_GEMINI_API_KEY in your environment variables.",
            );
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        // Using gemini-2.5-flash as gemini-2.5-flash is not yet released/available in the SDK.
        // gemini-2.5-flash is the best direct replacement for gpt-4o-mini.
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }

    async streamChat(
        messages: ChatMessage[],
        onContent: (content: string, done: boolean) => void,
        _options?: { signal?: AbortSignal },
    ): Promise<void> {
        console.log(JSON.stringify(messages, null, 2));

        try {
            // Convert history to Gemini format (excluding the last message which is the latest prompt)
            const history = messages.slice(0, -1).map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            }));

            // Handle system instruction if present
            const systemMsg = messages.find(m => m.role === "system");
            const activeModel = systemMsg
                ? this.genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: systemMsg.content })
                : this.model;

            const chat = activeModel.startChat({
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
        } catch (error) {
            console.error("Error in streamChat:", error);
            throw error;
        }
    }

    async sendMessage(messages: ChatMessage[]): Promise<string> {
        try {
            const lastMessage = messages[messages.length - 1].content;
            const result = await this.model.generateContent(lastMessage);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Error in sendMessage:", error);
            throw error;
        }
    }
}
