import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'NextPrompt - AI Chatbot',
    description: 'AI-powered chatbot with Gemini featuring multimodal support and dynamic prompt options',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
