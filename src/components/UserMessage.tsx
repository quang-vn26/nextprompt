import React from "react";
import { RequestMessage } from "../types";
import { Card, Text, makeStyles, shorthands } from "@fluentui/react-components";

const useStyles = makeStyles({
    messageContainer: {
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: "12px",
    },
    messageCard: {
        maxWidth: "85%",
        backgroundImage: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)",
        ...shorthands.borderRadius("16px", "16px", "4px", "16px"),
        ...shorthands.padding("14px", "18px"),
        ...shorthands.border("1px", "solid", "rgba(99, 102, 241, 0.3)"),
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2), 0 0 12px rgba(99, 102, 241, 0.1)",
        transitionProperty: "all",
        transitionDuration: "0.25s",
        transitionTimingFunction: "ease",
    },
    messageContent: {
        fontSize: "15px",
        lineHeight: "1.6",
        color: "#f0f0f5",
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
