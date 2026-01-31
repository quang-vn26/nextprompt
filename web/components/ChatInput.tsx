'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Send, Paperclip, X } from 'lucide-react'
import { motion } from 'framer-motion'

interface ChatInputProps {
    onSend: (content: string, file?: File) => void
    disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [input, setInput] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = () => {
        if (!input.trim() && !selectedFile) return
        if (disabled) return

        onSend(input.trim(), selectedFile || undefined)

        // Reset
        setInput('')
        setSelectedFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Basic validation
            if (file.size > 20 * 1024 * 1024) {
                alert('File size too large (max 20MB)')
                return
            }
            if (!file.type.startsWith('image/')) {
                alert('Only image files are allowed')
                return
            }
            setSelectedFile(file)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {/* File Preview */}
            {selectedFile && (
                <div className="flex items-center gap-3 glass-panel rounded-xl p-3 border border-cyber-500/30">
                    <div className="flex-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg glass-panel flex items-center justify-center">
                            <span className="text-xl">📸</span>
                        </div>
                        <span className="text-sm text-slate-200 truncate">
                            {selectedFile.name}
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedFile(null)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                        title="Remove file"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Input Container */}
            <div className="glass-panel rounded-2xl p-4 glow-cyber relative overflow-hidden">
                <div className="scan-line" />
                <div className="flex items-end gap-3">
                    {/* File Upload Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-cyber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Attach image"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Text Input */}
                    <div className="flex-1">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={disabled}
                            placeholder="Enter your command..."
                            rows={1}
                            className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none text-sm max-h-32"
                        />
                    </div>

                    {/* Send Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSubmit}
                        disabled={disabled || (!input.trim() && !selectedFile)}
                        className="glass-panel px-4 py-2 rounded-xl bg-gradient-to-r from-cyber-600 to-neon-violet hover:from-cyber-500 hover:to-neon-violet/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-violet flex items-center justify-center"
                        title="Send message"
                    >
                        <Send className="w-4 h-4 text-white" />
                    </motion.button>
                </div>

                {/* Tech Decoration */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyber-500 to-transparent" />
            </div>
        </div>
    )
}
