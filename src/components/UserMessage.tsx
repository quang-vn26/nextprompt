import React from "react";
import { RequestMessage } from "../types";
import { Card, Text, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
    messageContainer: {
        display: "flex",
        justifyContent: "flex-start",
        marginBottom: tokens.spacingVerticalM,
    },
    messageCard: {
        maxWidth: "100%",
        backgroundColor: tokens.colorNeutralBackground5,
        color: tokens.colorNeutralForeground1,
        padding: tokens.spacingVerticalM,
        marginLeft: tokens.spacingVerticalM,
        border: "none",
        boxShadow: "none",
    },
    messageHeader: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        marginBottom: tokens.spacingVerticalS,
    },
    userName: {
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
    },
    messageContent: {
        fontSize: tokens.fontSizeBase300,
        lineHeight: tokens.lineHeightBase300,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    },
});

interface UserMessageProps {
    message: RequestMessage;
}

export const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
    const styles = useStyles();

    return (
        <div className={styles.messageContainer}>
            <Card className={styles.messageCard}>
                <Text className={styles.messageContent}>{message.content}</Text>
            </Card>
        </div>
    );
};
