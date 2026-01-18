import React from "react";
import { makeStyles, tokens, Radio, Checkbox, Text, Label, Switch } from "@fluentui/react-components";
import {
    BasicOptions,
    SingleOptionControl,
    MultiOptionControl,
    BinaryOptionControl,
    basicOptionSet as b,
} from "../promptions-llm";
import { VisualOptionSet, OptionRenderer } from "./types";

const useStyles = makeStyles({
    optionsContainer: {
        marginBottom: tokens.spacingVerticalM,
        padding: tokens.spacingVerticalS,
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    optionGroup: {
        marginBottom: tokens.spacingVerticalM,
    },
    optionLabel: {
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        marginBottom: tokens.spacingVerticalXS,
        color: tokens.colorNeutralForeground1,
    },
    optionType: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground3,
        marginBottom: tokens.spacingVerticalS,
        fontStyle: "italic",
    },
    choicesContainer: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalM,
    },
    choiceItem: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        padding: tokens.spacingVerticalXS,
    },
    toggleContainer: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    toggleLabel: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground1,
    },
});

interface SingleSelectOptionProps {
    option: SingleOptionControl;
    optionIndex: number;
    options: BasicOptions;
    set: (options: BasicOptions) => void;
    disabled: boolean;
}

const SingleSelectOption: React.FC<SingleSelectOptionProps> = ({ option, optionIndex, options, set, disabled }) => {
    const styles = useStyles();

    const currentValue = Array.isArray(option.value) ? option.value[0] : option.value;

    return (
        <div className={styles.choicesContainer}>
            {Object.entries(option.options).map(([key, label]) => (
                <div key={key} className={styles.choiceItem}>
                    <Label>
                        <Radio
                            value={key}
                            checked={currentValue === key}
                            disabled={disabled}
                            onChange={() => {
                                if (disabled) return;
                                set(
                                    new BasicOptions(
                                        options.options.map((opt, idx) =>
                                            idx === optionIndex ? { ...opt, value: key } : opt,
                                        ) as any,
                                    ),
                                );
                            }}
                        />
                        {label}
                    </Label>
                </div>
            ))}
        </div>
    );
};

interface MultiSelectOptionProps {
    option: MultiOptionControl;
    optionIndex: number;
    options: BasicOptions;
    set: (options: BasicOptions) => void;
    disabled: boolean;
}

const MultiSelectOption: React.FC<MultiSelectOptionProps> = ({ option, optionIndex, options, set, disabled }) => {
    const styles = useStyles();

    return (
        <div className={styles.choicesContainer}>
            {Object.entries(option?.options ?? []).map(([key, label]) => {
                const currentValues = Array.isArray(option.value) ? option.value : [];
                const isChecked = currentValues.includes(key);

                return (
                    <div key={key} className={styles.choiceItem}>
                        <Label>
                            <Checkbox
                                checked={isChecked}
                                disabled={disabled}
                                onChange={() => {
                                    if (disabled) return;
                                    const newValues = isChecked
                                        ? currentValues.filter((v: string) => v !== key)
                                        : [...currentValues, key];

                                    set(
                                        new BasicOptions(
                                            options.options.map((opt, idx) =>
                                                idx === optionIndex ? { ...opt, value: newValues } : opt,
                                            ) as any,
                                        ),
                                    );
                                }}
                            />
                            {label}
                        </Label>
                    </div>
                );
            })}
        </div>
    );
};

interface BinaryOptionProps {
    option: BinaryOptionControl;
    optionIndex: number;
    options: BasicOptions;
    set: (options: BasicOptions) => void;
    disabled: boolean;
}

const BinaryOption: React.FC<BinaryOptionProps> = ({ option, optionIndex, options, set, disabled }) => {
    const styles = useStyles();
    const isEnabled = option.value === "enabled";

    return (
        <div className={styles.toggleContainer}>
            <Label className={styles.toggleLabel}>{isEnabled ? option.options.enabled : option.options.disabled}</Label>
            <Switch
                checked={isEnabled}
                disabled={disabled}
                onChange={(_, data) => {
                    if (disabled) return;
                    const newValue = data.checked ? "enabled" : "disabled";
                    set(
                        new BasicOptions(
                            options.options.map((opt, idx) =>
                                idx === optionIndex ? { ...opt, value: newValue } : opt,
                            ) as any,
                        ),
                    );
                }}
            />
        </div>
    );
};

const MessageOptions: OptionRenderer = ({ options, set, disabled = false }) => {
    const styles = useStyles();

    if (!(options instanceof BasicOptions)) {
        throw new Error("Expected options to be an instance of BasicOptions");
    }

    return (
        <div className={styles.optionsContainer}>
            {options.options.map((option: any, optionIndex: number) => (
                <div key={optionIndex} className={styles.optionGroup}>
                    <Text className={styles.optionLabel}>{option.label}</Text>

                    {option.kind === "single-select" ? (
                        <SingleSelectOption
                            option={option}
                            optionIndex={optionIndex}
                            options={options}
                            set={set}
                            disabled={disabled}
                        />
                    ) : option.kind === "binary-select" ? (
                        <BinaryOption
                            option={option}
                            optionIndex={optionIndex}
                            options={options}
                            set={set}
                            disabled={disabled}
                        />
                    ) : (
                        <MultiSelectOption
                            option={option}
                            optionIndex={optionIndex}
                            options={options}
                            set={set}
                            disabled={disabled}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

export const basicOptionSet: VisualOptionSet<BasicOptions> = {
    ...b,
    getComponent: () => MessageOptions,
};
