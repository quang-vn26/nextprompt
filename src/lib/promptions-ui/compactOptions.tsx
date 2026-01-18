import React from "react";
import {
    makeStyles,
    tokens,
    Dropdown,
    Option,
    Switch,
    Label,
    Combobox,
    Tag,
    TagGroup,
    Button,
} from "@fluentui/react-components";
import { Dismiss12Regular } from "@fluentui/react-icons";
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
        borderRadius: tokens.borderRadiusMedium,
        backgroundColor: tokens.colorNeutralBackground2,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    optionGroup: {
        marginBottom: tokens.spacingVerticalM,
        "&:last-child": {
            marginBottom: "0",
        },
    },
    optionLabel: {
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        marginBottom: tokens.spacingVerticalXS,
        color: tokens.colorNeutralForeground1,
        display: "block",
    },
    optionType: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground3,
        marginBottom: tokens.spacingVerticalS,
        fontStyle: "italic",
    },
    singleSelectContainer: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalM,
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
    dropdownContainer: {
        minWidth: "200px",
    },
    multiSelectContainer: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    selectedTags: {
        marginTop: tokens.spacingVerticalXS,
        display: "flex",
        flexWrap: "wrap",
        rowGap: tokens.spacingHorizontalS,
    },
});

interface CompactSingleSelectOptionProps {
    option: SingleOptionControl;
    optionIndex: number;
    options: BasicOptions;
    set: (options: BasicOptions) => void;
    disabled: boolean;
}

const CompactSingleSelectOption: React.FC<CompactSingleSelectOptionProps> = ({
    option,
    optionIndex,
    options,
    set,
    disabled,
}) => {
    const styles = useStyles();
    const optionEntries = Object.entries(option.options);
    const currentValue = Array.isArray(option.value) ? option.value[0] : option.value;

    // For single-select with more than 2 options, use a dropdown
    return (
        <div className={styles.dropdownContainer}>
            <Dropdown
                value={option.options[currentValue] || currentValue}
                selectedOptions={[currentValue]}
                disabled={disabled}
                onOptionSelect={(_, data) => {
                    if (disabled) return;
                    const selectedValue = data.optionValue;
                    if (selectedValue) {
                        set(
                            new BasicOptions(
                                options.options.map((opt, idx) =>
                                    idx === optionIndex ? { ...opt, value: selectedValue } : opt,
                                ) as any,
                            ),
                        );
                    }
                }}
            >
                {optionEntries.map(([key, label]) => (
                    <Option key={key} value={key}>
                        {label as string}
                    </Option>
                ))}
            </Dropdown>
        </div>
    );
};

interface CompactMultiSelectOptionProps {
    option: MultiOptionControl;
    optionIndex: number;
    options: BasicOptions;
    set: (options: BasicOptions) => void;
    disabled: boolean;
}

const CompactMultiSelectOption: React.FC<CompactMultiSelectOptionProps> = ({
    option,
    optionIndex,
    options,
    set,
    disabled,
}) => {
    const styles = useStyles();
    const optionEntries = Object.entries(option.options);
    const currentValues = Array.isArray(option.value) ? option.value : [];

    return (
        <div className={styles.multiSelectContainer}>
            <Combobox
                multiselect
                placeholder="Select options..."
                disabled={disabled}
                selectedOptions={currentValues}
                value={currentValues.map((val: string) => option.options[val] || val).join(", ")}
                onOptionSelect={(_, data) => {
                    if (disabled) return;
                    const selectedValue = data.optionValue;
                    if (selectedValue) {
                        const isCurrentlySelected = currentValues.includes(selectedValue);
                        const newValues = isCurrentlySelected
                            ? currentValues.filter((v: string) => v !== selectedValue)
                            : [...currentValues, selectedValue];

                        set(
                            new BasicOptions(
                                options.options.map((opt, idx) =>
                                    idx === optionIndex ? { ...opt, value: newValues } : opt,
                                ) as any,
                            ),
                        );
                    }
                }}
            >
                {optionEntries.map(([key, label]) => (
                    <Option key={key} value={key}>
                        {label as string}
                    </Option>
                ))}
            </Combobox>

            {currentValues.length > 0 && (
                <TagGroup className={styles.selectedTags}>
                    {currentValues.map((value: string) => (
                        <div key={value} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Tag>{option.options[value] || value}</Tag>
                            {!disabled && (
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    icon={<Dismiss12Regular />}
                                    onClick={() => {
                                        const newValues = currentValues.filter((v: string) => v !== value);
                                        set(
                                            new BasicOptions(
                                                options.options.map((opt, idx) =>
                                                    idx === optionIndex ? { ...opt, value: newValues } : opt,
                                                ) as any,
                                            ),
                                        );
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </TagGroup>
            )}
        </div>
    );
};

interface CompactBinaryOptionProps {
    option: BinaryOptionControl;
    optionIndex: number;
    options: BasicOptions;
    set: (options: BasicOptions) => void;
    disabled: boolean;
}

const CompactBinaryOption: React.FC<CompactBinaryOptionProps> = ({ option, optionIndex, options, set, disabled }) => {
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

const CompactMessageOptions: OptionRenderer = ({ options, set, disabled = false }) => {
    const styles = useStyles();

    if (!(options instanceof BasicOptions)) {
        throw new Error("Expected options to be an instance of BasicOptions");
    }

    return (
        <div className={styles.optionsContainer}>
            {options.options.map((option: any, optionIndex: number) => (
                <div key={optionIndex} className={styles.optionGroup}>
                    <Label className={styles.optionLabel}>{option.label}</Label>

                    {option.kind === "single-select" ? (
                        <CompactSingleSelectOption
                            option={option}
                            optionIndex={optionIndex}
                            options={options}
                            set={set}
                            disabled={disabled}
                        />
                    ) : option.kind === "binary-select" ? (
                        <CompactBinaryOption
                            option={option}
                            optionIndex={optionIndex}
                            options={options}
                            set={set}
                            disabled={disabled}
                        />
                    ) : (
                        <CompactMultiSelectOption
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

// Export as a new visual option set
export const compactOptionSet: VisualOptionSet<BasicOptions> = {
    ...b,
    getComponent: () => CompactMessageOptions,
};
