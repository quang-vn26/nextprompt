import { motion } from 'framer-motion'
import { User, Bot } from 'lucide-react'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

interface ChatMessageProps {
    message: Message
}

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === 'user'

    return (
        <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`w-10 h-10 rounded-xl glass-panel flex items-center justify-center flex-shrink-0 ${isUser ? 'glow-pink' : 'glow-cyber'
                    }`}
            >
                {isUser ? (
                    <User className="w-5 h-5 text-neon-pink" />
                ) : (
                    <Bot className="w-5 h-5 text-cyber-400" />
                )}
            </motion.div>

            {/* Message Bubble */}
            <div className={`flex flex-col gap-2 max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Role Badge */}
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">
                        {isUser ? 'You' : 'NextPrompt'}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-600">
                        {message.timestamp.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </span>
                </div>

                {/* Message Content */}
                <motion.div
                    initial={{ opacity: 0, x: isUser ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`relative rounded-2xl px-6 py-4 tech-lines ${isUser
                            ? 'glass-panel bg-gradient-to-br from-neon-pink/20 to-neon-violet/20 border-l-2 border-neon-pink glow-pink'
                            : 'glass-panel border-l-4 border-cyber-500 glow-cyber'
                        }`}
                >
                    {/* Scan Line Effect */}
                    {!isUser && <div className="scan-line" />}

                    {/* Message Text */}
                    <div className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                        {message.content}
                    </div>

                    {/* Corner Decoration for User Messages */}
                    {isUser && (
                        <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-neon-pink/50" />
                    )}
                </motion.div>
            </div>
        </div>
    )
}
