import React from "react";
import { makeStyles, tokens, Text, Card, CardHeader, Button, RadioGroup, Radio } from "@fluentui/react-components";
import { Settings24Regular } from "@fluentui/react-icons";
import { VisualOptionSet, BasicOptions } from "../lib/promptions-ui";

const useStyles = makeStyles({
    sidebar: {
        height: "100vh",
        backgroundColor: tokens.colorNeutralBackground2,
        borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease-in-out",
        overflow: "hidden",
    },
    sidebarCollapsed: {
        width: "60px",
        minWidth: "60px",
    },
    sidebarExpanded: {
        width: "300px",
        minWidth: "300px",
    },
    toggleButton: {
        width: "48px",
        height: "48px",
        margin: tokens.spacingVerticalS,
        alignSelf: "center",
        borderRadius: tokens.borderRadiusMedium,
        flexShrink: 0,
    },
    expandedContent: {
        padding: tokens.spacingHorizontalM,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        transition: "opacity 0.3s ease-in-out 0.1s", // Delay opacity to let width animate first
        overflow: "auto",
        flex: 1,
        minWidth: 0, // Prevent content from forcing width
    },
    collapsedContent: {
        opacity: 0,
        pointerEvents: "none",
        transition: "opacity 0.2s ease-in-out", // Faster fade out
    },
    card: {
        padding: tokens.spacingHorizontalM,
        backgroundColor: tokens.colorNeutralBackground1,
    },
    optionGroup: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
    optionLabel: {
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
        marginBottom: tokens.spacingVerticalXS,
    },
    radioGroup: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
    description: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground2,
        marginTop: tokens.spacingVerticalXS,
        lineHeight: "1.4",
    },
});

export interface ChatOptionsPanelProps {
    visualOptionSet: VisualOptionSet<BasicOptions>;
    onOptionSetChange: (optionSet: VisualOptionSet<BasicOptions>) => void;
    availableOptionSets: { key: string; label: string; optionSet: VisualOptionSet<BasicOptions> }[];
    isVisible: boolean;
    onToggleVisibility: () => void;
}

export const ChatOptionsPanel: React.FC<ChatOptionsPanelProps> = ({
    visualOptionSet,
    onOptionSetChange,
    availableOptionSets,
    isVisible,
    onToggleVisibility,
}) => {
    const styles = useStyles();

    const currentOptionKey = availableOptionSets.find((opt) => opt.optionSet === visualOptionSet)?.key || "compact";

    const handleOptionChange = (_event: React.FormEvent<HTMLDivElement>, data: { value: string }) => {
        const selectedOption = availableOptionSets.find((opt) => opt.key === data.value);
        if (selectedOption) {
            onOptionSetChange(selectedOption.optionSet);
        }
    };

    return (
        <div className={`${styles.sidebar} ${isVisible ? styles.sidebarExpanded : styles.sidebarCollapsed}`}>
            {/* Toggle Button */}
            <Button
                className={styles.toggleButton}
                appearance="subtle"
                icon={<Settings24Regular />}
                onClick={onToggleVisibility}
                title={isVisible ? "Close Options Panel" : "Open Options Panel"}
            />

            <div className={`${styles.expandedContent} ${!isVisible ? styles.collapsedContent : ""}`}>
                <Card className={styles.card}>
                    <CardHeader>
                        <Text className={styles.optionLabel}>Display Style</Text>
                    </CardHeader>

                    <div className={styles.optionGroup}>
                        <RadioGroup
                            value={currentOptionKey}
                            onChange={handleOptionChange}
                            className={styles.radioGroup}
                        >
                            {availableOptionSets.map((option) => (
                                <Radio key={option.key} value={option.key} label={option.label} />
                            ))}
                        </RadioGroup>
                        <Text className={styles.description}>
                            Choose how options are displayed in the chat. Expanded options show detailed controls, while
                            compact options use dropdown menus to save space.
                        </Text>
                    </div>
                </Card>
            </div>
        </div>
    );
};
