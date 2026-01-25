import React from "react";
import { FluentProvider, webDarkTheme, makeStyles } from "@fluentui/react-components";
import { ChatService } from "./services/ChatService";
import { ChatMessage, PromptionsService } from "./services/PromptionsService";
import { current, produce } from "immer";
import { depsEqual, useMounted, usePreviousIf } from "./reactUtil";
import { ChatInput, ChatHistory, ChatOptionsPanel } from "./components";
import {
    State,
    RefreshParams,
    OptionsParams,
    ChatParams,
    RequestMessage,
    ResponseMessage,
    ErrorMessage,
    HistoryMessage,
    compareRefreshParams,
    compareOptionsParams,
    compareChatParams,
} from "./types";
import { compactOptionSet, basicOptionSet, BasicOptions, VisualOptionSet } from "./lib/promptions-ui";
import { useChat } from "./contexts/ChatContext";

const useStyles = makeStyles({
    appContainer: {
        height: "100vh",
        display: "flex",
        flexDirection: "row",
        background: "transparent",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
    },
    chatContainer: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
    },
    chatScrollArea: {
        flex: 1,
        overflowY: "auto",
        position: "relative",
        scrollBehavior: "smooth",
    },
    chatPanel: {
        width: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        position: "relative",
    },
    messagesContainer: {
        flex: 1,
        padding: "24px 16px",
        "@media (min-width: 768px)": {
            padding: "32px 24px",
        },
    },
    inputContainer: {
        padding: "16px",
        background: "rgba(10, 10, 15, 0.9)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        position: "sticky",
        bottom: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "center",
        "@media (min-width: 768px)": {
            padding: "20px 24px",
        },
    },
    inputWrapper: {
        width: "100%",
        maxWidth: "800px",
        "@media (min-width: 768px)": {
            width: "80%",
        },
        "@media (min-width: 1200px)": {
            width: "60%",
        },
    },
});

// Available option sets
const availableOptionSets = [
    { key: "compact", label: "Compact Options", optionSet: compactOptionSet },
    { key: "expanded", label: "Expanded Options", optionSet: basicOptionSet },
];

// Default option set
const defaultOptionSet = basicOptionSet;

// Enable autoscroll for better UX in the new layout
const enableAutoscroll = true;

function updateHistoryContent(
    content: string,
    done: boolean,
    historySet: (fn: (prev: HistoryMessage[]) => void) => void,
) {
    historySet((draft) => {
        const lastMessage = draft.at(-1);
        if (lastMessage?.role !== "assistant") return;
        lastMessage.content = content;
        lastMessage.contentDone = done;
    });
}

function updateHistoryOptions(
    options: BasicOptions,
    done: boolean,
    historySet: (fn: (prev: HistoryMessage[]) => void) => void,
    currentOptionSet: VisualOptionSet<BasicOptions>,
) {
    historySet((draft) => {
        const lastMessage = draft.at(-1);
        if (lastMessage?.role !== "assistant") return;
        lastMessage.options = currentOptionSet.mergeOptions(lastMessage.options as BasicOptions, options);
        lastMessage.optionsDone = done;
    });
}

function updateHistoryWithError(message: ErrorMessage, historySet: (fn: (prev: HistoryMessage[]) => void) => void) {
    historySet((draft) => {
        draft.pop();
        draft.push(message);
    });
}

function updateHistoryClear(
    options: boolean,
    content: boolean,
    historySet: (fn: (prev: HistoryMessage[]) => void) => void,
    currentOptionSet: VisualOptionSet<BasicOptions>,
) {
    historySet((draft) => {
        const lastMessage = draft.at(-1);
        if (lastMessage?.role !== "assistant") return;
        if (options) {
            lastMessage.options = currentOptionSet.emptyOptions();
            lastMessage.optionsDone = false;
        }
        if (content) {
            lastMessage.content = "";
            lastMessage.contentDone = false;
        }
    });
}

const scrolledToBottom = (element: HTMLElement) => element.scrollTop > element.scrollHeight - element.clientHeight - 10;

// Helper function to get refresh parameters
const getRefreshParams = (history: HistoryMessage[], refreshRequestId: string): RefreshParams | undefined => {
    const refreshMessage = history.find((x) => x.id === refreshRequestId);
    const historyUpToRefresh = refreshMessage ? history.slice(0, history.indexOf(refreshMessage)) : undefined;
    return historyUpToRefresh && refreshMessage && refreshMessage.role === "assistant" && refreshMessage.contentDone
        ? { refreshMessage: refreshMessage, historyUpToRefresh }
        : undefined;
};

// Helper function to get options parameters
const getOptionsParams = (
    penultRequest: RequestMessage | undefined,
    lastResponse: ResponseMessage | undefined,
    prevHistory: HistoryMessage[],
): OptionsParams | undefined => {
    return penultRequest && lastResponse
        ? {
            message: penultRequest.content,
            prevHistory: prevHistory,
        }
        : undefined;
};

// Helper function to get chat parameters
const getChatParams = (
    penultRequest: RequestMessage | undefined,
    lastResponse: ResponseMessage | undefined,
    prevHistory: HistoryMessage[],
    refreshRequestId: string,
): ChatParams | undefined => {
    return penultRequest && lastResponse && lastResponse.optionsDone && !refreshRequestId
        ? {
            message: penultRequest.content,
            inlineOptions: lastResponse.options,
            prevHistory: prevHistory,
        }
        : undefined;
};

function elaborateMessagesWithOptions(messages: HistoryMessage[]): ChatMessage[] {
    const output: ChatMessage[] = [];

    for (const msg of messages) {
        if (msg.role === "user") {
            output.push({ role: "user", content: msg.content });
        }
        if (msg.role === "assistant") {
            const options = msg.options;
            if (options.prettyPrintAsConversation) {
                const { question, answer } = options.prettyPrintAsConversation();
                output.push({ role: "assistant", content: question });
                output.push({ role: "user", content: answer });
                output.push({ role: "assistant", content: msg.content });
            } else {
                output.push({ role: "user", content: options.prettyPrint() });
                output.push({ role: "assistant", content: msg.content });
            }
        }
    }

    return output;
}

const ChatPanel: React.FC<{
    refreshRequest: State<string>;
    historyState: State<HistoryMessage[]>;
    pendingScroll: React.MutableRefObject<boolean>;
    chatContainerRef: React.RefObject<HTMLDivElement>;
    styles: ReturnType<typeof useStyles>;
    currentOptionSet: VisualOptionSet<BasicOptions>;
    promptions: PromptionsService;
    chatService: ChatService;
}> = (props) => {
    const { historyState, refreshRequest, pendingScroll, chatContainerRef, styles, currentOptionSet, promptions, chatService } =
        props;
    const penultMessage = historyState.get.at(-2);
    const lastMessage = historyState.get.at(-1);
    const penultRequest = penultMessage?.role === "user" ? penultMessage : undefined;
    const lastResponse = lastMessage?.role === "assistant" ? lastMessage : undefined;

    const prevHistory = usePreviousIf(historyState.get.slice(0, -2), depsEqual);
    const _setter = historyState.set;
    const historySet = React.useCallback(
        (fn: (prev: HistoryMessage[]) => void) => {
            _setter((prev: any) => {
                const snapshot = current(prev);
                fn(prev);

                if (chatContainerRef.current != null) {
                    // We don't want to fight the user over the scroll position.
                    // If the user has scrolled up, we won't scroll down.

                    // Two conditions when we want to scroll:
                    //   - new messages are being appended
                    //   - the user is at the bottom of the chat
                    const shouldScroll = snapshot.length < prev.length || scrolledToBottom(chatContainerRef.current);
                    if (shouldScroll && enableAutoscroll) pendingScroll.current = true;
                }
            });
        },
        [_setter, pendingScroll, chatContainerRef],
    );

    const doRefreshParams = usePreviousIf(getRefreshParams(historyState.get, refreshRequest.get), compareRefreshParams);

    React.useEffect(() => {
        if (doRefreshParams === undefined) return;

        const abort = new AbortController();

        // Debounce the async function call by 100ms
        const timeoutId = setTimeout(() => {
            (async () => {
                if (abort.signal.aborted) {
                    return;
                }

                historySet((draft) => {
                    const refreshMessage = draft.find((x) => x.id === doRefreshParams.refreshMessage.id);
                    if (refreshMessage && refreshMessage.role === "assistant") {
                        refreshMessage.content = "";
                        refreshMessage.contentDone = false;
                        refreshMessage.options = basicOptionSet.emptyOptions();
                        refreshMessage.optionsDone = false;
                        draft.splice(draft.indexOf(refreshMessage) + 1);
                    }
                });

                const history = elaborateMessagesWithOptions(doRefreshParams.historyUpToRefresh);

                try {
                    await promptions.refreshOptions(
                        doRefreshParams.refreshMessage.options,
                        history,
                        (options, done) => {
                            updateHistoryOptions(options as BasicOptions, done, historySet, currentOptionSet);
                        },
                    );
                } catch (error) {
                    if ((error as Error).name === 'AbortError') {
                        console.log("Chat request aborted by user");
                        return;
                    }
                    updateHistoryWithError(
                        { id: crypto.randomUUID(), role: "error", content: (error as Error).message },
                        historySet,
                    );
                } finally {
                    refreshRequest.set(() => "");
                }
            })();
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            abort.abort("effect disposed");
        };
    }, [doRefreshParams, historySet, refreshRequest.set]);

    // Kick off the creation of the options as required, when the chat history changes.
    const doOptionsParams = usePreviousIf(
        getOptionsParams(penultRequest, lastResponse, prevHistory),
        compareOptionsParams,
    );

    React.useEffect(() => {
        if (doOptionsParams === undefined) return;

        const { message, prevHistory } = doOptionsParams;

        const abort = new AbortController();

        const timeoutId = setTimeout(() => {
            (async () => {
                if (abort.signal.aborted) {
                    return;
                }

                updateHistoryClear(true, true, historySet, currentOptionSet);

                const history = [
                    ...elaborateMessagesWithOptions(prevHistory),
                    { role: "user", content: message } as const,
                ];

                if (abort.signal.aborted) {
                    return;
                }

                try {
                    await promptions.getOptions(history, (options, done) => {
                        updateHistoryOptions(options as BasicOptions, done, historySet, currentOptionSet);
                    });
                } catch (error) {
                    updateHistoryWithError(
                        { id: crypto.randomUUID(), role: "error", content: (error as Error).message },
                        historySet,
                    );
                }
            })();
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            abort.abort("effect disposed");
        };
    }, [doOptionsParams, historySet]);

    const doChatParams = usePreviousIf(
        getChatParams(penultRequest, lastResponse, prevHistory, refreshRequest.get),
        compareChatParams,
    );

    React.useEffect(() => {
        if (doChatParams === undefined) return;

        const { message, inlineOptions, prevHistory } = doChatParams;

        const abort = new AbortController();

        // Debounce the async function call by 100ms
        const timeoutId = setTimeout(() => {
            (async () => {
                if (abort.signal.aborted) {
                    return;
                }

                // Clear content before regenerating.
                updateHistoryClear(false, true, historySet, currentOptionSet);

                const history = [
                    {
                        role: "system",
                        content:
                            "You are a helpful AI chat bot. When responding to a user consider whether they have provided any additional settings or selections. If they have, do not ask them extra follow-up questions but continue with their intent based on the context.",
                    } as const,
                    ...elaborateMessagesWithOptions([
                        ...prevHistory,
                        { id: "", role: "user", content: message } as const,
                        {
                            id: "",
                            role: "assistant",
                            content: "",
                            options: inlineOptions as BasicOptions,
                            optionsDone: false,
                            contentDone: false,
                        } as const,
                    ]).slice(0, -1),
                ];

                if (abort.signal.aborted) {
                    return;
                }

                try {
                    await chatService.streamChat(
                        history,
                        (content, done) => {
                            updateHistoryContent(content, done, historySet);
                        },
                        { signal: abort.signal },
                    );
                } catch (error) {
                    if ((error as Error).name === 'AbortError') {
                        console.log("Chat request aborted by user");
                        return;
                    }
                    updateHistoryWithError(
                        { id: crypto.randomUUID(), role: "error", content: (error as Error).message },
                        historySet,
                    );
                }
            })();
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            abort.abort("effect disposed");
        };
    }, [doChatParams, historySet]);

    const send = async (message: string) => {
        historySet((draft) => {
            draft.push({ id: crypto.randomUUID(), role: "user", content: message });
            draft.push({
                id: crypto.randomUUID(),
                role: "assistant",
                options: currentOptionSet.emptyOptions(),
                optionsDone: false,
                content: "",
                contentDone: false,
            });
        });
    };

    return (
        <div className={styles.chatPanel}>
            {/* Messages container without scrolling */}
            <div className={styles.messagesContainer}>
                <ChatHistory history={historyState.get} historySet={historySet} currentOptionSet={currentOptionSet} />
            </div>
            {/* Input container anchored to bottom */}
            <div className={styles.inputContainer}>
                <div className={styles.inputWrapper}>
                    <ChatInput
                        disabled={
                            lastResponse !== undefined && (!lastResponse.optionsDone || !lastResponse.contentDone)
                        }
                        send={send}
                        historyState={historyState}
                    />
                </div>
            </div>
        </div>
    );
};

function App() {
    const mount = useMounted();
    const [history, setChatHistory] = React.useState<HistoryMessage[]>([]);
    const [refreshRequestId, setRefreshRequestId] = React.useState<string>("");
    const [currentOptionSet, setCurrentOptionSet] = React.useState<VisualOptionSet<BasicOptions>>(defaultOptionSet);
    const [optionsPanelVisible, setOptionsPanelVisible] = React.useState(false);
    const styles = useStyles();

    const { chatService, getPromptionsService } = useChat();

    // Create promptions service instance with current option set
    const promptions = React.useMemo(() => {
        return getPromptionsService(currentOptionSet);
    }, [currentOptionSet, getPromptionsService]);

    const historyState: State<HistoryMessage[]> = {
        get: history,
        set: React.useCallback(
            (f: any) => {
                if (!mount.isMounted) return;
                setChatHistory((prev) => {
                    const next = produce(prev, f);
                    return next;
                });
            },
            [mount],
        ),
    };

    const refreshRequest: State<string> = {
        get: refreshRequestId,
        set: React.useCallback(
            (f: (prev: string) => void) => {
                if (!mount.isMounted) return;
                setRefreshRequestId((prev) => {
                    const next = produce(prev, f);
                    return next;
                });
            },
            [mount],
        ),
    };

    const pendingScroll = React.useRef(false);
    const chatContainerRef = React.useRef<HTMLDivElement>(null);

    const handleOptionSetChange = (newOptionSet: VisualOptionSet<BasicOptions>) => {
        setCurrentOptionSet(newOptionSet);
    };

    const handleToggleOptionsPanel = () => {
        setOptionsPanelVisible(!optionsPanelVisible);
    };

    React.useLayoutEffect(() => {
        if (pendingScroll.current && chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                behavior: "smooth",
                top: chatContainerRef.current.scrollHeight,
            });
            pendingScroll.current = false;
        }
    });

    return (
        <FluentProvider theme={webDarkTheme}>
            <div className={styles.appContainer}>
                {/* Expanding Sidebar */}
                <ChatOptionsPanel
                    visualOptionSet={currentOptionSet}
                    onOptionSetChange={handleOptionSetChange}
                    availableOptionSets={availableOptionSets}
                    isVisible={optionsPanelVisible}
                    onToggleVisibility={handleToggleOptionsPanel}
                />

                {/* Chat Container */}
                <div className={styles.chatContainer}>
                    <div className={styles.chatScrollArea} ref={chatContainerRef}>
                        <ChatPanel
                            refreshRequest={refreshRequest}
                            historyState={historyState}
                            pendingScroll={pendingScroll}
                            chatContainerRef={chatContainerRef}
                            styles={styles}
                            currentOptionSet={currentOptionSet}
                            promptions={promptions}
                            chatService={chatService}
                        />
                    </div>
                </div>
            </div>
        </FluentProvider>
    );
}

export default App;
