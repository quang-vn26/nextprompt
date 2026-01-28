'use client'

import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react'
import { Send, Paperclip, X, Image as ImageIcon } from 'lucide-react'

interface ChatInputProps {
    value: string
    onChange: (value: string) => void
    onSend: (content: string, file?: File) => void
    disabled?: boolean
}

export default function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = () => {
        if (!value.trim() && !selectedFile) return
        if (disabled) return

        onSend(value.trim(), selectedFile || undefined)

        // Reset file (Input is reset by parent)
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

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Basic validation
            if (file.size > 20 * 1024 * 1024) {
                console.warn('File too large! Please select a file smaller than 20MB.')
                return
            }
            if (!file.type.startsWith('image/')) {
                console.warn('Only image files are accepted.')
                return
            }
            setSelectedFile(file)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {/* File Preview */}
            {selectedFile && (
                <div className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-4 border border-cyber-500/30 animate-fade-in">
                    <div className="flex-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyber-500/20 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-cyber-400" />
                        </div>
                        <span className="text-sm text-slate-200 truncate font-medium">
                            {selectedFile.name}
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedFile(null)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                        title="Remove file"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Input Container */}
            <div className="glass-panel rounded-2xl p-4 glow-cyber relative overflow-hidden">
                 <div className="scan-line" />
                 <div className="flex gap-3 items-end">
                    {/* File Upload Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                        className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-cyber-500/50 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                        title="Upload image"
                    >
                        <Paperclip className="w-5 h-5 text-slate-400 group-hover:text-cyber-400 transition-colors" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Text Input */}
                    <div className="flex-1 relative">
                        <textarea
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={disabled}
                            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                            rows={1}
                            className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none text-sm max-h-32 min-h-[1.5rem]"
                        />
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={disabled || (!value.trim() && !selectedFile)}
                        className="glass-panel px-4 py-2 rounded-xl bg-gradient-to-r from-cyber-600 to-neon-violet hover:from-cyber-500 hover:to-neon-violet/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow-violet flex items-center justify-center"
                        title="Send message"
                    >
                        <Send className="w-4 h-4 text-white" />
                    </button>
                </div>
                {/* Tech Decoration */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyber-500 to-transparent" />
            </div>
        </div>
    )
}
