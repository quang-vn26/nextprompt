import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import App from "./App";
import { MemoryProvider } from "./contexts/MemoryContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <MemoryProvider>
            <FluentProvider theme={webLightTheme}>
                <App />
            </FluentProvider>
        </MemoryProvider>
    </React.StrictMode>,
);
