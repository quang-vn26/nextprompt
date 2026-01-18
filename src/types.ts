import { Options } from "../../../packages/promptions-llm/src";

// State type for reactive state management
export type State<T> = { get: T; set: (fn: (prev: T) => void) => void };

// Message types
export interface RequestMessage {
    id: string;
    role: "user";
    content: string;
}

export interface ResponseMessage {
    id: string;
    role: "assistant";
    options: Options;
    optionsDone: boolean;
    content: string;
    contentDone: boolean;
}

export type ErrorMessage = {
    id: string;
    role: "error";
    content: string;
};

export type HistoryMessage = RequestMessage | ResponseMessage | ErrorMessage;

export interface RefreshParams {
    refreshMessage: ResponseMessage;
    historyUpToRefresh: HistoryMessage[];
}

export interface OptionsParams {
    message: string;
    prevHistory: HistoryMessage[];
}

export interface ChatParams {
    message: string;
    inlineOptions: Options;
    prevHistory: HistoryMessage[];
}

// Comparison functions for effect parameters
export const compareRefreshParams = (prev: RefreshParams | undefined, next: RefreshParams | undefined): boolean => {
    return prev?.historyUpToRefresh === next?.historyUpToRefresh && prev?.refreshMessage.id === next?.refreshMessage.id;
};

export const compareOptionsParams = (prev: OptionsParams | undefined, next: OptionsParams | undefined): boolean => {
    return (
        prev !== undefined &&
        next !== undefined &&
        prev.message === next.message &&
        prev.prevHistory === next.prevHistory
    );
};

export const compareChatParams = (prev: ChatParams | undefined, next: ChatParams | undefined): boolean => {
    return (
        prev !== undefined &&
        next !== undefined &&
        prev.message === next.message &&
        prev.inlineOptions === next.inlineOptions &&
        prev.prevHistory === next.prevHistory
    );
};
