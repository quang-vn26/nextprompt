import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css"; // You can choose a different theme

interface MarkdownRendererProps {
    content: string;
    className?: string;
    style?: React.CSSProperties;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className, style }) => {
    return (
        <div className={`markdown-content ${className || ""}`} style={style}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    // Custom components for better styling
                    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                    // Ensure code blocks have proper styling
                    pre: ({ node, ...props }) => <pre {...props} style={{ overflow: "auto", maxWidth: "100%" }} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
