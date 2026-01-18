export interface Options {
    prettyPrint(): string;
    prettyPrintAsConversation?(): { question: string; answer: string };
    isEmpty(): boolean;
}

export interface OptionSet<T extends Options> {
    /**
     * Return a string representation describing the option schema that is suitable for LLMs to understand
     * and generate conforming JSON.
     */
    getSchemaSpec(): string;
    /**
     * Validate the provided JSON string against the option schema.
     */
    validateJSON(value: string): T | undefined;
    /**
     * Incrementally validate a partial JSON string against the option schema
     */
    validatePartialJSON?(value: string): T | undefined;
    /**
     * Returns empty options useful for initializing state or when no options are available.
     */
    emptyOptions(): T;
    /**
     * Merge two options together. Used for apply updates to existing options.
     */
    mergeOptions(base: T, update: T): T;
}
