import React from "react";
import { FluentProvider, webDarkTheme, makeStyles } from "@fluentui/react-components";
import { ChatService } from "./services/ChatService";
import { PromptionsService } from "./services/PromptionsService";
import { produce } from "immer";
import { useMounted } from "./reactUtil";
import { ChatInput, ChatHistory, ChatOptionsPanel } from "./components";
import {
    State,
    HistoryMessage,
} from "./types";
import { compactOptionSet, basicOptionSet, BasicOptions, VisualOptionSet } from "./lib/promptions-ui";
import { useChatLogic } from "./hooks/useChatLogic";

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

const chat = new ChatService();

// Available option sets
const availableOptionSets = [
    { key: "compact", label: "Compact Options", optionSet: compactOptionSet },
    { key: "expanded", label: "Expanded Options", optionSet: basicOptionSet },
];

// Default option set
const defaultOptionSet = basicOptionSet;

const ChatPanel: React.FC<{
    refreshRequest: State<string>;
    historyState: State<HistoryMessage[]>;
    pendingScroll: React.MutableRefObject<boolean>;
    chatContainerRef: React.RefObject<HTMLDivElement>;
    styles: ReturnType<typeof useStyles>;
    currentOptionSet: VisualOptionSet<BasicOptions>;
    promptions: PromptionsService;
}> = (props) => {
    const { historyState, refreshRequest, pendingScroll, chatContainerRef, styles, currentOptionSet, promptions } =
        props;
    const lastMessage = historyState.get.at(-1);
    const lastResponse = lastMessage?.role === "assistant" ? lastMessage : undefined;

    const { send, historySet } = useChatLogic(
        historyState,
        refreshRequest,
        currentOptionSet,
        promptions,
        chat,
        pendingScroll,
        chatContainerRef
    );

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

    // Create promptions service instance with current option set
    const promptions = React.useMemo(() => {
        return new PromptionsService(chat, currentOptionSet);
    }, [currentOptionSet]);

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
                        />
                    </div>
                </div>
            </div>
        </FluentProvider>
    );
}

export default App;
