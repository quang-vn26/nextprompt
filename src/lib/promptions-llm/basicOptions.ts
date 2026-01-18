import * as z from "zod";
import { OptionSet, Options } from "./types";

const multiOptionControl = z.object({
    kind: z.literal("multi-select"),
    label: z.string(),
    options: z.record(z.string()),
    value: z.union([z.string(), z.array(z.string())]),
});

const singleOptionControl = z.object({
    kind: z.literal("single-select"),
    label: z.string(),
    options: z.record(z.string()),
    value: z.union([z.string(), z.tuple([z.string()])]),
});

const binaryOptionControl = z.object({
    kind: z.literal("binary-select"),
    label: z.string(),
    options: z.object({
        enabled: z.string(),
        disabled: z.string(),
    }),
    value: z.union([z.literal("enabled"), z.literal("disabled")]),
});

const optionControl = z.union([multiOptionControl, singleOptionControl, binaryOptionControl]);
const optionControlList = z.array(optionControl);
type OptionControlList = z.infer<typeof optionControlList>;

// Export individual option types
export type MultiOptionControl = z.infer<typeof multiOptionControl>;
export type SingleOptionControl = z.infer<typeof singleOptionControl>;
export type BinaryOptionControl = z.infer<typeof binaryOptionControl>;
export type OptionControl = z.infer<typeof optionControl>;

export class BasicOptions implements Options {
    constructor(readonly options: OptionControlList) { }

    prettyPrint(): string {
        return this.options
            .map((control) => {
                if (control.kind === "single-select") {
                    const selectedValue = Array.isArray(control.value) ? control.value[0] : control.value;
                    const selectedLabel = control.options[selectedValue] || selectedValue;
                    return `Single Select: ${control.label} with options [${Object.keys(control.options).join(", ")}] - Selected: ${selectedLabel}`;
                } else if (control.kind === "binary-select") {
                    const selectedValue = control.value;
                    const selectedLabel = control.options[selectedValue] || selectedValue;
                    return `Binary Select: ${control.label} with options [${Object.entries(control.options)
                        .map(([key, label]) => `${key}: ${label}`)
                        .join(", ")}] - Selected: ${selectedLabel}`;
                } else {
                    const selectedValues = Array.isArray(control.value) ? control.value : [control.value];
                    const selectedLabels = selectedValues.map((val) => control.options[val] || val);
                    return `Multi Select: ${control.label} with options [${Object.keys(control.options).join(", ")}] - Selected: ${selectedLabels.join(", ")}`;
                }
            })
            .join("\n\n");
    }

    prettyPrintAsConversation(): { question: string; answer: string } {
        const question = this.options
            .map((control) => {
                if (control.kind === "single-select") {
                    return `What is your choice for ${control.label}? Options are: ${Object.entries(control.options)
                        .map(([key, label]) => `${key}: ${label}`)
                        .join(", ")}`;
                } else if (control.kind === "binary-select") {
                    return `What is your choice for ${control.label}? Options are: ${Object.entries(control.options)
                        .map(([key, label]) => `${key}: ${label}`)
                        .join(", ")}`;
                } else {
                    return `What are your choices for ${control.label}? Options are: ${Object.entries(control.options)
                        .map(([key, label]) => `${key}: ${label}`)
                        .join(", ")}`;
                }
            })
            .join("\n");

        const answer = this.options
            .map((control) => {
                if (control.kind === "single-select") {
                    const selectedValue = Array.isArray(control.value) ? control.value[0] : control.value;
                    const selectedLabel = control.options[selectedValue] || selectedValue;
                    return `${control.label}: ${selectedLabel}`;
                } else if (control.kind === "binary-select") {
                    const selectedValue = control.value;
                    const selectedLabel = control.options[selectedValue] || selectedValue;
                    return `${control.label}: ${selectedLabel}`;
                } else {
                    const selectedValues = Array.isArray(control.value) ? control.value : [control.value];
                    const selectedLabels = selectedValues.map((val) => control.options[val] || val);
                    return `${control.label}: ${selectedLabels.join(", ")}`;
                }
            })
            .join("\n");

        return { question, answer };
    }

    mergeOptions(update: BasicOptions): BasicOptions {
        const thisLen = this.options.length;
        // keep any options after len
        const mergedControls = [...this.options.slice(0, thisLen), ...update.options.slice(thisLen)];
        return new BasicOptions(mergedControls);
    }

    isEmpty(): boolean {
        return this.options.length === 0;
    }
}

const schemaString: string = `\`\`\`typescript
interface SingleOptionControl {
  kind: "single-select";
  label: string;
  options: Record<string, string>;
  value: string;
}

interface MultiOptionControl {
  kind: "multi-select";
  label: string;
  options: Record<string, string>;
  value: string[]; // Must include at least one option
}

interface BinaryOptionControl {
  kind: "binary-select";
  label: string;
  options: {
    enabled: string; // Label for enabled state
    disabled: string; // Label for disabled state
  };
  value: "enabled" | "disabled"; // Must be either "enabled" or "disabled"
}

type OptionControl = SingleOptionControl | MultiOptionControl | BinaryOptionControl;

type OptionControlList = OptionControl[];
\`\`\``;

export const basicOptionSet: OptionSet<BasicOptions> = {
    getSchemaSpec: () => schemaString,
    validateJSON: (value: string): BasicOptions | undefined => {
        try {
            const parsed = JSON.parse(value);

            // First try to parse as the original format
            const originalResult = optionControlList.safeParse(parsed);
            if (originalResult.success) {
                return new BasicOptions(originalResult.data);
            }

            // If that fails, try to parse as the flattened JSON schema format
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.options)) {
                const transformedOptions = parsed.options.map((item: any) => {
                    if (item.kind === "binary-select") {
                        return {
                            kind: item.kind,
                            label: item.label,
                            options: {
                                enabled: item.enabled_label || "Yes",
                                disabled: item.disabled_label || "No",
                            },
                            value: item.selected_values[0] || "disabled",
                        };
                    } else {
                        // Convert flattened format back to our internal format
                        const options: Record<string, string> = {};
                        if (item.option_keys && item.option_values) {
                            for (let i = 0; i < Math.min(item.option_keys.length, item.option_values.length); i++) {
                                options[item.option_keys[i]] = item.option_values[i];
                            }
                        }

                        return {
                            kind: item.kind,
                            label: item.label,
                            options: options,
                            value: item.kind === "single-select" ? item.selected_values[0] : item.selected_values,
                        };
                    }
                });

                const transformedResult = optionControlList.safeParse(transformedOptions);
                if (transformedResult.success) {
                    return new BasicOptions(transformedResult.data);
                }
            }

            return undefined;
        } catch (error) {
            return undefined;
        }
    },
    validatePartialJSON: (value: string): BasicOptions | undefined => {
        try {
            let jsonStr = value;
            const arrayStart = jsonStr.indexOf("[");
            if (arrayStart === -1) return undefined;

            jsonStr = jsonStr.substring(arrayStart);

            for (let i = jsonStr.lastIndexOf("},"); i >= 0; i = jsonStr.lastIndexOf("},", i - 1)) {
                const potentialJson = jsonStr.substring(0, i + 1) + "]";

                try {
                    const parsed = JSON.parse(potentialJson);
                    if (Array.isArray(parsed)) {
                        const validated = basicOptionSet.validateJSON(JSON.stringify(parsed));
                        if (validated) {
                            return validated;
                        }
                    }
                } catch {
                    continue;
                }
            }

            const completeJsonAttempts = [jsonStr, jsonStr + "]", jsonStr.replace(/,\s*$/, "") + "]"];

            for (const attempt of completeJsonAttempts) {
                try {
                    const parsed = JSON.parse(attempt);
                    if (Array.isArray(parsed)) {
                        const validated = basicOptionSet.validateJSON(JSON.stringify(parsed));
                        if (validated) {
                            return validated;
                        }
                    }
                } catch {
                    continue;
                }
            }
            return undefined;
        } catch (error) {
            return undefined;
        }
    },
    emptyOptions: () => new BasicOptions([]),
    mergeOptions: (base: BasicOptions, update: BasicOptions): BasicOptions => {
        return base.mergeOptions(update);
    },
};
