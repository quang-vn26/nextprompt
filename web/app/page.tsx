'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Loader2, ChevronRight } from 'lucide-react'
import ChatMessage from '@/components/ChatMessage'
import Sidebar from '@/components/Sidebar'
import { Message } from '@/types'

const quickActions = [
    "Explain quantum computing",
    "Write a poem about AI",
    "Debug my code",
    "Translate to Vietnamese",
]

export default function Home() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Welcome to **NextPrompt**. I am your AI assistant, ready to help you with any task. How may I assist you today?',
            timestamp: new Date(),
        },
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        }

        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        // Simulate API call
        setTimeout(() => {
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `You said: "${input}". API integration will be added in Day 2.`,
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, assistantMessage])
            setIsLoading(false)
        }, 1500)
    }

    const handleQuickAction = (action: string) => {
        setInput(action)
    }

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden">
            {/* Background Tech Grid */}
            <div className="fixed inset-0 bg-tech-grid opacity-50 pointer-events-none" />

            {/* Holographic Gradient Orbs */}
            <div className="fixed top-0 right-0 w-96 h-96 bg-cyber-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-96 h-96 bg-neon-violet/20 rounded-full blur-3xl pointer-events-none" />

            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative z-10">
                {/* Header */}
                <header className="glass-panel border-b border-white/10 px-6 py-4 relative overflow-hidden">
                    <div className="scan-line" />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg glass-panel flex items-center justify-center glow-cyber">
                                <Sparkles className="w-5 h-5 text-cyber-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-holographic">NextPrompt</h1>
                                <p className="text-xs text-slate-400">AI-Powered Assistant</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="glass-panel px-3 py-1 rounded-full flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-xs text-slate-300">Online</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto scrollbar-cyber px-6 py-6">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <AnimatePresence initial={false}>
                            {messages.map((message, index) => (
                                <motion.div
                                    key={message.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                >
                                    <ChatMessage message={message} />
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Typing Indicator */}
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3"
                            >
                                <div className="glass-panel rounded-2xl px-6 py-4 glow-cyber">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-cyber-400" />
                                        <div className="flex gap-1">
                                            <motion.div
                                                className="w-2 h-2 bg-cyber-400 rounded-full"
                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                                            />
                                            <motion.div
                                                className="w-2 h-2 bg-cyber-400 rounded-full"
                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                                            />
                                            <motion.div
                                                className="w-2 h-2 bg-cyber-400 rounded-full"
                                                animate={{ opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                                            />
                                        </div>
                                        <span className="text-xs text-slate-400">Analyzing...</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Input Area - Floating Command Center */}
                <div className="px-6 pb-6 relative">
                    <div className="max-w-4xl mx-auto">
                        {/* Quick Actions Bar */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide"
                        >
                            {quickActions.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleQuickAction(action)}
                                    className="glass-panel glass-panel-hover px-4 py-2 rounded-full text-xs text-slate-300 whitespace-nowrap flex items-center gap-2 group"
                                >
                                    <ChevronRight className="w-3 h-3 text-cyber-400 group-hover:translate-x-1 transition-transform" />
                                    {action}
                                </button>
                            ))}
                        </motion.div>

                        {/* Input Container */}
                        <div className="glass-panel rounded-2xl p-4 glow-cyber relative overflow-hidden">
                            <div className="scan-line" />
                            <div className="flex items-end gap-3">
                                <div className="flex-1">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSend()
                                            }
                                        }}
                                        placeholder="Enter your command..."
                                        rows={1}
                                        className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none text-sm"
                                        disabled={isLoading}
                                    />
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSend}
                                    disabled={!input.trim() || isLoading}
                                    className="glass-panel px-4 py-2 rounded-xl bg-gradient-to-r from-cyber-600 to-neon-violet hover:from-cyber-500 hover:to-neon-violet/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-violet"
                                >
                                    <Send className="w-4 h-4 text-white" />
                                </motion.button>
                            </div>

                            {/* Tech Decoration */}
                            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyber-500 to-transparent" />
                        </div>

                        {/* Footer Info */}
                        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
                            <div className="w-1 h-1 rounded-full bg-cyber-500 animate-pulse" />
                            <span>Day 1 • Backend API will be integrated in Day 2</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
