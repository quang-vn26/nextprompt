import { ChatService } from "./ChatService";
import { Options, OptionSet } from "../lib/promptions-llm";

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export class PromptionsService {
    private chatService: ChatService;
    private optionSet: OptionSet<Options>;

    constructor(chatService: ChatService, optionSet: OptionSet<Options>) {
        this.chatService = chatService;
        this.optionSet = optionSet;
    }

    private async generateOptions(
        systemPrompt: ChatMessage,
        chatHistory: ChatMessage[],
        onOptions: (options: Options, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const messages: ChatMessage[] = [systemPrompt, ...chatHistory];

        await this.chatService.streamChat(
            messages,
            (content, done) => {
                if (done) {
                    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                    const jsonText = jsonMatch ? jsonMatch[1] : content.trim();
                    const parsedOptions = this.optionSet.validateJSON(jsonText);
                    if (!parsedOptions) {
                        throw new Error(`Invalid options JSON: ${jsonText}`);
                    }
                    return onOptions(parsedOptions, true);
                }
                const partialOptions = this.tryParsePartialOptions(content);
                if (partialOptions) {
                    onOptions(partialOptions, done);
                }
            },
            options,
        );
    }

    async getOptions(
        chatHistory: ChatMessage[],
        onOptions: (options: Options, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const systemPrompt: ChatMessage = {
            role: "system",
            content: `You are an AI assistant that generates interactive options based on conversation history. 

Given a chat conversation, analyze the context and generate relevant interactive options that the user might want to select from.

Your response must be a valid JSON array following this exact schema:
${this.optionSet.getSchemaSpec()}

Guidelines for generating options:
1. Analyze the conversation history to understand the context and user's needs
2. Generate 2-4 relevant option controls that would be useful for the user
3. For single-select options, provide 3-5 meaningful choices
4. For multi-select options, provide 4-8 options where multiple selections make sense
5. Use clear, descriptive labels for both the controls and their options
6. Make sure the options are contextually relevant to the conversation
7. Return ONLY the JSON array in a single json markdown block, without any additional text or explanation.

Example output format:
<example>
\`\`\`json
[
  ...
]
\`\`\`
</example>
`,
        };

        return this.generateOptions(systemPrompt, chatHistory, onOptions, options);
    }

    async refreshOptions(
        existingOptions: Options,
        chatHistory: ChatMessage[],
        onOptions: (options: Options, done: boolean) => void,
        options?: { signal?: AbortSignal },
    ): Promise<void> {
        const formattedExistingOptions = existingOptions.prettyPrint();

        const systemPrompt: ChatMessage = {
            role: "system",
            content: `You are an AI assistant that regenerates interactive options based on conversation history and existing options. 

Given a chat conversation and a set of existing options, analyze the updated context and generate new relevant interactive options that the user might want to select from. Consider the existing options as context but generate fresh, contextually appropriate options for the current state of the conversation.

Current existing options:
${formattedExistingOptions}

Your response must be a valid JSON array following this exact schema:
${this.optionSet.getSchemaSpec()}

Guidelines for regenerating options:
1. Analyze the conversation history to understand the updated context and user's evolving needs
2. Consider the existing options but don't feel constrained to replicate them exactly
3. Generate 2-4 relevant option controls that would be useful for the user in the current context
4. For single-select options, provide 3-5 meaningful choices
5. For multi-select options, provide 4-8 options where multiple selections make sense
6. Use clear, descriptive labels for both the controls and their options
7. Make sure the new options are contextually relevant to the current conversation state
8. The new options should reflect any progression or changes in the conversation since the existing options were generated
9. Return ONLY the JSON array in a single json markdown block, without any additional text or explanation.

Example output format:
<example>
\`\`\`json
[
  ...
]
\`\`\`
`,
        };

        return this.generateOptions(systemPrompt, chatHistory, onOptions, options);
    }

    private tryParsePartialOptions(optionsStr: string): Options | undefined {
        try {
            const jsonMatch = optionsStr.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
            let jsonStr = jsonMatch ? jsonMatch[1] : optionsStr;
            return this.optionSet.validatePartialJSON?.(jsonStr);
        } catch (error) {
            // Incomplete JSON or other parse error, expected during streaming
            return undefined;
        }
    }
}
