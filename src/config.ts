
export const config = {
    gemini: {
        apiKey: import.meta.env.VITE_GEMINI_API_KEY,
        model: "gemini-2.5-flash",
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
        }
    },
    openai: {
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        model: "gpt-4.1-mini",
        defaults: {
            temperature: 0.7,
            maxTokens: 2048,
        }
    },
    retry: {
        maxRetries: 2,
        initialDelayMs: 2000,
        maxDelayMs: 10000,
    }
};
