export interface Config {
    geminiApiKey: string;
    openaiApiKey: string;
    geminiModel: string;
    openaiModel: string;
}

export const config: Config = {
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
    openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
    geminiModel: "gemini-2.5-flash",
    openaiModel: "gpt-4.1-mini",
};

// Validate configuration
if (!config.geminiApiKey) {
    console.warn("Gemini API key not found. Please set VITE_GEMINI_API_KEY in .env");
}

if (!config.openaiApiKey) {
    console.warn("OpenAI API key not found. Please set VITE_OPENAI_API_KEY in .env");
}
