import React from "react";
import { HistoryMessage } from "../types";
import { Textarea, makeStyles, Button } from "@fluentui/react-components";
import { Send24Regular, Delete24Regular, Sparkle20Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
    containerWrapper: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    inputContainer: {
        display: "flex",
        gap: "12px",
        alignItems: "flex-end",
        background: "rgba(26, 26, 38, 0.6)",
        backdropFilter: "blur(16px)",
        borderRadius: "16px",
        padding: "12px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        transition: "all 0.25s ease",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
    },
    textareaWrapper: {
        flex: 1,
        display: "flex",
    },
    input: {
        flex: 1,
        minHeight: "44px",
        maxHeight: "200px",
        background: "transparent",
        border: "none",
        color: "#f0f0f5",
        fontSize: "15px",
        lineHeight: "1.5",
        resize: "none",
    },
    buttonGroup: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
    },
    sendButton: {
        minWidth: "40px",
        height: "40px",
        padding: "0",
        borderRadius: "12px",
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
        border: "none",
        color: "white",
        transition: "all 0.25s ease",
        boxShadow: "0 0 12px rgba(99, 102, 241, 0.3)",
    },
    clearButton: {
        minWidth: "40px",
        height: "40px",
        padding: "0",
        borderRadius: "12px",
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        color: "#a0a0b0",
        transition: "all 0.25s ease",
    },
    disclaimerText: {
        fontSize: "12px",
        color: "#6b6b7b",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        paddingLeft: "4px",
    },
});

type State<T> = { get: T; set: (fn: (prev: T) => void) => void };

interface ChatInputProps {
    disabled: boolean;
    send: (message: string) => void;
    historyState: State<HistoryMessage[]>;
}

export const ChatInput: React.FC<ChatInputProps> = (props) => {
    const { disabled, send, historyState } = props;
    const [text, setText] = React.useState("");
    const styles = useStyles();

    const onSend = () => {
        if (text.trim()) {
            setText("");
            send(text);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey && !disabled && !event.repeat && text.trim()) {
            event.preventDefault();
            onSend();
        }
    };

    return (
        <div className={styles.containerWrapper}>
            <div className={styles.inputContainer}>
                <div className={styles.textareaWrapper}>
                    <Textarea
                        value={text}
                        disabled={disabled}
                        placeholder="Ask me anything..."
                        autoComplete="off"
                        autoFocus
                        className={styles.input}
                        onChange={(_, data) => setText(data.value)}
                        onKeyDown={handleKeyDown}
                        resize="none"
                    />
                </div>
                <div className={styles.buttonGroup}>
                    <Button
                        appearance="primary"
                        disabled={disabled || !text.trim()}
                        onClick={onSend}
                        className={styles.sendButton}
                        icon={<Send24Regular />}
                        title="Send message"
                    />
                    <Button
                        appearance="subtle"
                        onClick={() => {
                            historyState.set(() => []);
                        }}
                        className={styles.clearButton}
                        icon={<Delete24Regular />}
                        title="Clear chat"
                    />
                </div>
            </div>
            <div className={styles.disclaimerText}>
                <Sparkle20Regular />
                AI responses may be inaccurate. Verify important information.
            </div>
        </div>
    );
};
