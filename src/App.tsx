import React from "react";
import { FluentProvider, webDarkTheme, makeStyles } from "@fluentui/react-components";
import { ChatService } from "./services/ChatService";
import { PromptionsService } from "./services/PromptionsService";
import { produce } from "immer";
import { useMounted } from "./reactUtil";
import { ChatOptionsPanel } from "./components";
import { ChatPanel } from "./components/ChatPanel";
import {
    State,
    HistoryMessage,
} from "./types";
import { compactOptionSet, basicOptionSet, BasicOptions, VisualOptionSet } from "./lib/promptions-ui";

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
});

const chat = new ChatService();

// Available option sets
const availableOptionSets = [
    { key: "compact", label: "Compact Options", optionSet: compactOptionSet },
    { key: "expanded", label: "Expanded Options", optionSet: basicOptionSet },
];

// Default option set
const defaultOptionSet = basicOptionSet;

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
            (f: (draft: HistoryMessage[]) => void) => {
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
                            chatService={chat}
                            refreshRequest={refreshRequest}
                            historyState={historyState}
                            pendingScroll={pendingScroll}
                            chatContainerRef={chatContainerRef}
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
