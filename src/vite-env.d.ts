/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string;
    readonly VITE_OPENAI_API_KEY: string;
    readonly VITE_PHI4_ENDPOINT: string;
    readonly VITE_PHI4_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
