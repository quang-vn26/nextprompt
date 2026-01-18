import React from "react";
import { ErrorMessage } from "../types";
import { Card, Text, makeStyles, tokens, Avatar } from "@fluentui/react-components";
import { ErrorCircle24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
    messageContainer: {
        display: "flex",
        justifyContent: "flext-start",
        marginBottom: tokens.spacingVerticalM,
    },
    messageCard: {
        maxWidth: "70%",
        backgroundColor: tokens.colorPaletteRedBackground1,
        padding: tokens.spacingVerticalM,
        border: "none",
        boxShadow: "none",
    },
    messageHeader: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        marginBottom: tokens.spacingVerticalS,
    },
    errorTitle: {
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground2,
    },
    messageContent: {
        fontSize: tokens.fontSizeBase300,
        lineHeight: tokens.lineHeightBase300,
        color: tokens.colorNeutralForeground1,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    },
});

interface ErrorMessageComponentProps {
    message: ErrorMessage;
}

export const ErrorMessageComponent: React.FC<ErrorMessageComponentProps> = ({ message }) => {
    const styles = useStyles();

    return (
        <div className={styles.messageContainer}>
            <Card className={styles.messageCard}>
                <div className={styles.messageHeader}>
                    <Avatar icon={<ErrorCircle24Regular />} size={20} color="neutral" />
                    <Text className={styles.errorTitle}>Error</Text>
                </div>
                <Text className={styles.messageContent}>{message.content}</Text>
            </Card>
        </div>
    );
};
