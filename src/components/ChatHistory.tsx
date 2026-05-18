import React from "react";
import { makeStyles } from "@fluentui/react-components";
import { UserMessage, AssistantMessage, ErrorMessageComponent } from "./";
import { HistoryMessage } from "../types";
import type { BasicOptions, VisualOptionSet, Options } from "../lib/promptions-ui";

const useStyles = makeStyles({
    chatRow: {
        display: "flex",
        width: "100%",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: "0",
        marginBottom: "24px",
        animation: "fadeInUp 0.4s ease-out forwards",
        "@media (max-width: 768px)": {
            flexDirection: "column",
        },
    },
    messagesColumn: {
        width: "100%",
        maxWidth: "800px",
        display: "flex",
        flexDirection: "column",
        "@media (min-width: 768px)": {
            width: "50%",
            minWidth: "50%",
        },
    },
    optionsColumn: {
        width: "100%",
        paddingLeft: "0",
        paddingTop: "16px",
        "@media (min-width: 768px)": {
            width: "25%",
            minWidth: "25%",
            paddingLeft: "16px",
            paddingTop: "0",
            position: "sticky",
            top: "24px",
        },
    },
    spacerColumn: {
        display: "none",
        "@media (min-width: 768px)": {
            display: "block",
            width: "25%",
        },
    },
    welcomeContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        padding: "24px",
    },
    welcomeIcon: {
        fontSize: "80px",
        marginBottom: "24px",
        animation: "pulse 2s ease-in-out infinite",
        filter: "drop-shadow(0 0 20px rgba(99, 102, 241, 0.4))",
    },
    welcomeTitle: {
        fontSize: "2rem",
        fontWeight: "700",
        marginBottom: "16px",
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
        backgroundSize: "200% 200%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: "gradientText 3s ease infinite",
    },
    welcomeSubtitle: {
        fontSize: "1.1rem",
        color: "#a0a0b0",
        maxWidth: "450px",
        lineHeight: "1.6",
    },
    refreshButton: {
        minWidth: "24px",
        height: "24px",
        padding: "2px",
        marginBottom: "8px",
    },
    optionsHeader: {
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: "8px",
    },
});

interface ChatHistoryProps {
    history: HistoryMessage[];
    historySet: (fn: (prev: HistoryMessage[]) => void) => void;
    currentOptionSet: VisualOptionSet<BasicOptions>;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ history, historySet, currentOptionSet }) => {
    const styles = useStyles();

    const OptionRenderer = currentOptionSet.getComponent();

    if (history.length === 0) {
        return (
            <div className={styles.chatRow}>
                <div className={styles.spacerColumn}></div>
                <div className={styles.messagesColumn}>
                    <div className={styles.welcomeContainer}>
                        <div className={styles.welcomeIcon}>✨</div>
                        <h2 className={styles.welcomeTitle}>Welcome to Promptions AI</h2>
                        <p className={styles.welcomeSubtitle}>
                            Start a conversation below. I'll help you with creative prompts, ideas, and interactive options.
                        </p>
                    </div>
                </div>
                <div className={styles.optionsColumn}></div>
            </div>
        );
    }

    // Find the latest assistant message
    let latestAssistantId: string | undefined;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === "assistant") {
            latestAssistantId = history[i].id;
            break;
        }
    }

    return (
        <>
            {history.map((message, i) => {
                if (message.role === "user") {
                    return (
                        <div key={message.id} className={styles.chatRow} style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className={styles.spacerColumn}></div>
                            <div className={styles.messagesColumn}>
                                <UserMessage message={message} />
                            </div>
                            <div className={styles.optionsColumn}></div>
                        </div>
                    );
                } else if (message.role === "assistant") {
                    return (
                        <div key={message.id} className={styles.chatRow} style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className={styles.spacerColumn}></div>
                            <div className={styles.messagesColumn}>
                                <AssistantMessage message={message} />
                            </div>
                            <div className={styles.optionsColumn}>
                                {message.options && !message.options.isEmpty() && (
                                    <OptionRenderer
                                        options={message.options as any}
                                        set={(updatedOptions: Options) => {
                                            historySet((draft) => {
                                                const msg = draft.find((m) => m.id === message.id);
                                                if (msg && msg.role === "assistant") {
                                                    msg.options = updatedOptions as BasicOptions;
                                                }
                                            });
                                        }}
                                        disabled={message.id !== latestAssistantId}
                                    />
                                )}
                            </div>
                        </div>
                    );
                } else if (message.role === "error") {
                    return (
                        <div key={message.id} className={styles.chatRow} style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className={styles.spacerColumn}></div>
                            <div className={styles.messagesColumn}>
                                <ErrorMessageComponent message={message} />
                            </div>
                            <div className={styles.optionsColumn}></div>
                        </div>
                    );
                }
                return null;
            })}
        </>
    );
};
