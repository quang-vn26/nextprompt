import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Settings, History, ChevronLeft, Plus, Trash2 } from 'lucide-react'

interface SidebarProps {
    isOpen: boolean
    onToggle: () => void
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
    const conversations = [
        { id: 1, title: 'Quantum Computing Basics', timestamp: '2h ago' },
        { id: 2, title: 'Poetry Generation', timestamp: '5h ago' },
        { id: 3, title: 'Code Debugging Help', timestamp: 'Yesterday' },
    ]

    return (
        <>
            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggle}
                className="fixed top-4 left-4 z-50 glass-panel p-2 rounded-lg glow-cyber"
            >
                <ChevronLeft className={`w-5 h-5 text-cyber-400 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
            </motion.button>

            {/* Sidebar Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.aside
                        initial={{ x: -320 }}
                        animate={{ x: 0 }}
                        exit={{ x: -320 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="w-80 glass-panel border-r border-white/10 flex flex-col relative z-40"
                    >
                        {/* Holographic Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-cyber-500/5 to-transparent pointer-events-none" />

                        {/* Header */}
                        <div className="p-6 border-b border-white/10">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full glass-panel glass-panel-hover p-4 rounded-xl flex items-center gap-3 glow-cyber"
                            >
                                <Plus className="w-5 h-5 text-cyber-400" />
                                <span className="text-sm font-medium">New Chat</span>
                            </motion.button>
                        </div>

                        {/* Conversations List */}
                        <div className="flex-1 overflow-y-auto scrollbar-cyber p-4 space-y-2">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <History className="w-3 h-3" />
                                Recent Conversations
                            </div>

                            {conversations.map((conv, idx) => (
                                <motion.button
                                    key={conv.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    whileHover={{ scale: 1.02, x: 4 }}
                                    className="w-full glass-panel glass-panel-hover p-3 rounded-lg flex items-start gap-3 group text-left"
                                >
                                    <MessageSquare className="w-4 h-4 text-cyber-400 mt-1 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-200 truncate">{conv.title}</p>
                                        <p className="text-xs text-slate-500 mt-1">{conv.timestamp}</p>
                                    </div>
                                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded">
                                        <Trash2 className="w-3 h-3 text-red-400" />
                                    </button>
                                </motion.button>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 space-y-2">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                className="w-full glass-panel glass-panel-hover p-3 rounded-lg flex items-center gap-3 text-sm"
                            >
                                <Settings className="w-4 h-4 text-slate-400" />
                                <span>Settings</span>
                            </motion.button>

                            {/* Tech Info Badge */}
                            <div className="glass-panel p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                    <span>System Online</span>
                                </div>
                                <div className="mt-2 text-xs text-slate-600">
                                    <code className="text-cyber-400">v1.0.0</code> • Day 1 Build
                                </div>
                            </div>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    )
}
