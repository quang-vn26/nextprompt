import React, { useCallback, useEffect } from "react";
import { current } from "immer";
import { usePreviousIf, depsEqual } from "../reactUtil";
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
} from "../types";
import { BasicOptions, VisualOptionSet, basicOptionSet } from "../lib/promptions-ui";
import { PromptionsService, ChatMessage } from "../services/PromptionsService";
import { ChatService } from "../services/ChatService";

// Helper functions moved from App.tsx
export function elaborateMessagesWithOptions(messages: HistoryMessage[]): ChatMessage[] {
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

const getRefreshParams = (history: HistoryMessage[], refreshRequestId: string): RefreshParams | undefined => {
    const refreshMessage = history.find((x) => x.id === refreshRequestId);
    const historyUpToRefresh = refreshMessage ? history.slice(0, history.indexOf(refreshMessage)) : undefined;
    return historyUpToRefresh && refreshMessage && refreshMessage.role === "assistant" && refreshMessage.contentDone
        ? { refreshMessage: refreshMessage, historyUpToRefresh }
        : undefined;
};

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

export function useChatLogic(
    historyState: State<HistoryMessage[]>,
    refreshRequest: State<string>,
    currentOptionSet: VisualOptionSet<BasicOptions>,
    promptions: PromptionsService,
    chat: ChatService,
    pendingScroll: React.MutableRefObject<boolean>,
    chatContainerRef: React.RefObject<HTMLDivElement>,
    enableAutoscroll: boolean = true
) {
    const penultMessage = historyState.get.at(-2);
    const lastMessage = historyState.get.at(-1);
    const penultRequest = penultMessage?.role === "user" ? penultMessage : undefined;
    const lastResponse = lastMessage?.role === "assistant" ? lastMessage : undefined;

    const prevHistory = usePreviousIf(historyState.get.slice(0, -2), depsEqual);
    const _setter = historyState.set;

    const historySet = useCallback(
        (fn: (prev: HistoryMessage[]) => void) => {
            _setter((prev: any) => {
                const snapshot = current(prev);
                fn(prev);

                if (chatContainerRef.current != null) {
                    const shouldScroll = snapshot.length < prev.length || scrolledToBottom(chatContainerRef.current);
                    if (shouldScroll && enableAutoscroll) pendingScroll.current = true;
                }
            });
        },
        [_setter, pendingScroll, chatContainerRef, enableAutoscroll],
    );

    // Refresh Logic
    const doRefreshParams = usePreviousIf(getRefreshParams(historyState.get, refreshRequest.get), compareRefreshParams);

    useEffect(() => {
        if (doRefreshParams === undefined) return;

        const abort = new AbortController();

        const timeoutId = setTimeout(() => {
            (async () => {
                if (abort.signal.aborted) return;

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
    }, [doRefreshParams, historySet, refreshRequest, promptions, currentOptionSet]);

    // Options Logic
    const doOptionsParams = usePreviousIf(
        getOptionsParams(penultRequest, lastResponse, prevHistory),
        compareOptionsParams,
    );

    useEffect(() => {
        if (doOptionsParams === undefined) return;

        const { message, prevHistory: _prevHistory } = doOptionsParams;

        const abort = new AbortController();

        const timeoutId = setTimeout(() => {
            (async () => {
                if (abort.signal.aborted) return;

                updateHistoryClear(true, true, historySet, currentOptionSet);

                const history = [
                    ...elaborateMessagesWithOptions(_prevHistory),
                    { role: "user", content: message } as const,
                ];

                if (abort.signal.aborted) return;

                try {
                    await promptions.getOptions(history, (options, done) => {
                        updateHistoryOptions(options as BasicOptions, done, historySet, currentOptionSet);
                    });
                } catch (error) {
                     if ((error as Error).name === 'AbortError') return;
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
    }, [doOptionsParams, historySet, currentOptionSet, promptions]);

    // Chat Logic
    const doChatParams = usePreviousIf(
        getChatParams(penultRequest, lastResponse, prevHistory, refreshRequest.get),
        compareChatParams,
    );

    useEffect(() => {
        if (doChatParams === undefined) return;

        const { message, inlineOptions, prevHistory: _prevHistory } = doChatParams;

        const abort = new AbortController();

        const timeoutId = setTimeout(() => {
            (async () => {
                if (abort.signal.aborted) return;

                updateHistoryClear(false, true, historySet, currentOptionSet);

                const history = [
                    {
                        role: "system",
                        content:
                            "You are a helpful AI chat bot. When responding to a user consider whether they have provided any additional settings or selections. If they have, do not ask them extra follow-up questions but continue with their intent based on the context.",
                    } as const,
                    ...elaborateMessagesWithOptions([
                        ..._prevHistory,
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

                if (abort.signal.aborted) return;

                try {
                    await chat.streamChat(
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
    }, [doChatParams, historySet, currentOptionSet, chat]);

    return {
        historySet,
        send: async (message: string) => {
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
        }
    };
}
