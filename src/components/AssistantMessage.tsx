import React from "react";
import { ResponseMessage } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Card, Skeleton, SkeletonItem, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
    messageContainer: {
        display: "flex",
        justifyContent: "flex-start",
        marginBottom: tokens.spacingVerticalM,
    },
    messageCard: {
        maxWidth: "100%",
        minWidth: "100%",
        backgroundColor: "transparent",
        color: tokens.colorNeutralForeground1,
        padding: tokens.spacingVerticalM,
        border: "none",
        boxShadow: "none",
    },
    messageContent: {
        fontSize: tokens.fontSizeBase300,
        lineHeight: tokens.lineHeightBase300,
    },
    thinkingContainer: {
        width: "80%",
    },
});

interface AssistantMessageProps {
    message: ResponseMessage;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
    const styles = useStyles();

    // Generate random widths for skeleton items
    const generateRandomWidth = () => Math.floor(Math.random() * 40) + 50; // 50-90%
    const skeletonWidths = React.useMemo(
        () => [`${generateRandomWidth()}%`, `${generateRandomWidth()}%`, `${generateRandomWidth()}%`],
        [],
    );

    return (
        <div className={styles.messageContainer}>
            <Card className={styles.messageCard}>
                {/* Render markdown content */}
                {message.content || !message.contentDone ? (
                    message.content ? (
                        <div className={styles.messageContent}>
                            <MarkdownRenderer content={message.content} />
                        </div>
                    ) : (
                        <div className={styles.thinkingContainer}>
                            <Skeleton
                                style={{ display: "flex", flexDirection: "column", gap: "5px" }}
                                aria-label="Loading Content"
                            >
                                <SkeletonItem style={{ width: skeletonWidths[0] }} />
                                <SkeletonItem style={{ width: skeletonWidths[1] }} />
                                <SkeletonItem style={{ width: skeletonWidths[2] }} />
                            </Skeleton>
                        </div>
                    )
                ) : null}
            </Card>
        </div>
    );
};
