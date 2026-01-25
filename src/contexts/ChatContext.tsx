import React, { createContext, useContext, useMemo } from 'react';
import { ChatService } from '../services/ChatService';
import { PromptionsService } from '../services/PromptionsService';
import { config } from '../config';
import { VisualOptionSet, BasicOptions } from '../lib/promptions-ui';

interface ChatContextType {
    chatService: ChatService;
    getPromptionsService: (optionSet: VisualOptionSet<BasicOptions>) => PromptionsService;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Instantiate ChatService once with the configuration
    const chatService = useMemo(() => new ChatService(config), []);

    // Factory method for PromptionsService since it depends on optionSet which is stateful in App
    const getPromptionsService = useMemo(() => {
        return (optionSet: VisualOptionSet<BasicOptions>) => new PromptionsService(chatService, optionSet);
    }, [chatService]);

    return (
        <ChatContext.Provider value={{ chatService, getPromptionsService }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChat must be used within ChatProvider');
    return context;
};
