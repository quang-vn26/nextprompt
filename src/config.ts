export const CONFIG = {
    API_KEYS: {
        GEMINI: import.meta.env.VITE_GEMINI_API_KEY as string | undefined,
        OPENAI: import.meta.env.VITE_OPENAI_API_KEY as string | undefined,
    },
    MODELS: {
        GEMINI: {
            NAME: "gemini-2.5-flash",
            TEMP: 0.7,
            MAX_TOKENS: 2048,
        },
        OPENAI: {
            // "gpt-4.1-mini" was in the original code. Preserving it to avoid regressions,
            // though "gpt-4o-mini" is the standard naming convention.
            NAME: "gpt-4.1-mini",
            TEMP: 0.7,
            MAX_TOKENS: 2048,
        }
    },
    RETRY: {
        MAX_RETRIES: 2,
        INITIAL_DELAY_MS: 2000,
        MAX_DELAY_MS: 10000,
    }
} as const;
