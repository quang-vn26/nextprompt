import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import App from "./App";
import "./index.css";
import { ChatProvider } from "./contexts/ChatContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <FluentProvider theme={webLightTheme}>
            <ChatProvider>
                <App />
            </ChatProvider>
        </FluentProvider>
    </React.StrictMode>,
);
