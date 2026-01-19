import React from "react";
import { ResponseMessage } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Card, makeStyles, shorthands } from "@fluentui/react-components";

const useStyles = makeStyles({
    messageContainer: {
        display: "flex",
        justifyContent: "flex-start",
        marginBottom: "12px",
    },
    messageCard: {
        maxWidth: "100%",
        minWidth: "100%",
        backgroundColor: "rgba(26, 26, 38, 0.5)",
        ...shorthands.borderRadius("16px"),
        ...shorthands.padding("16px", "20px"),
        ...shorthands.border("1px", "solid", "rgba(255, 255, 255, 0.06)"),
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
        transitionProperty: "all",
        transitionDuration: "0.25s",
        transitionTimingFunction: "ease",
    },
    messageContent: {
        fontSize: "15px",
        lineHeight: "1.7",
        color: "#f0f0f5",
    },
    loadingContainer: {
        display: "flex",
        flexDirection: "column",
        ...shorthands.gap("10px"),
        ...shorthands.padding("8px", "0"),
    },
    loadingLine: {
        height: "14px",
        ...shorthands.borderRadius("8px"),
        backgroundImage: "linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.2) 50%, rgba(99, 102, 241, 0.1) 100%)",
        backgroundSize: "200% 100%",
        animationName: {
            "0%": { backgroundPosition: "-200% 0" },
            "100%": { backgroundPosition: "200% 0" },
        },
        animationDuration: "1.5s",
        animationTimingFunction: "ease-in-out",
        animationIterationCount: "infinite",
    },
});

interface AssistantMessageProps {
    message: ResponseMessage;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
    const styles = useStyles();

    // Generate random widths for loading skeleton
    const skeletonWidths = React.useMemo(
        () => [
            `${Math.floor(Math.random() * 30) + 60}%`,
            `${Math.floor(Math.random() * 30) + 50}%`,
            `${Math.floor(Math.random() * 20) + 40}%`,
        ],
        [],
    );

    return (
        <div className={styles.messageContainer}>
            <Card className={styles.messageCard}>
                {message.content || !message.contentDone ? (
                    message.content ? (
                        <div className={styles.messageContent}>
                            <MarkdownRenderer content={message.content} />
                        </div>
                    ) : (
                        <div className={styles.loadingContainer}>
                            <div className={styles.loadingLine} style={{ width: skeletonWidths[0] }} />
                            <div className={styles.loadingLine} style={{ width: skeletonWidths[1], animationDelay: "0.15s" }} />
                            <div className={styles.loadingLine} style={{ width: skeletonWidths[2], animationDelay: "0.3s" }} />
                        </div>
                    )
                ) : null}
            </Card>
        </div>
    );
};
