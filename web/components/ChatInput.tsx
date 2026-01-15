'use client'

import { useState, useRef, KeyboardEvent } from 'react'

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
                alert('File quá mạnh! Vui lòng chọn file nhỏ hơn 20MB ⚡')
                return
            }
            if (!file.type.startsWith('image/')) {
                alert('Chỉ chấp nhận ảnh chiến đấu! 🔥')
                return
            }
            setSelectedFile(file)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {/* File Preview với Dragon Ball style */}
            {selectedFile && (
                <div className="flex items-center gap-3 bg-gradient-to-r from-ki-900/50 to-fire-900/50 rounded-xl p-4 border-3 border-saiyan-500 energy-glow animate-power-up">
                    <div className="flex-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-saiyan-500 to-fire-500 flex items-center justify-center animate-ki-charge">
                            <span className="text-2xl">📸</span>
                        </div>
                        <span className="text-sm text-saiyan-100 truncate font-semibold">
                            {selectedFile.name}
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedFile(null)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="text-fire-400 hover:text-fire-300 transition-all hover:scale-110 font-bold text-xl"
                        title="Hủy năng lượng"
                    >
                        ❌
                    </button>
                </div>
            )}

            {/* Input Container với Energy Effects */}
            <div className="flex gap-3 items-end">
                {/* File Upload Button - Dragon Ball style */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-namek-600 to-namek-500 hover:from-namek-500 hover:to-namek-400 border-3 border-namek-400 flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg animate-float"
                    title="Power Up với ảnh! 📸"
                >
                    <span className="text-3xl filter drop-shadow-lg">📎</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {/* Text Input với Ki Energy border */}
                <div className="flex-1 relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        placeholder="Nhập lệnh chiến đấu... (Enter để tung chiêu, Shift+Enter để xuống dòng) ⚡"
                        rows={1}
                        className="w-full resize-none bg-gradient-to-br from-slate-900/95 to-blue-950/95 text-white rounded-xl px-5 py-4 border-4 border-ki-500 focus:outline-none focus:border-saiyan-500 focus:ring-4 focus:ring-saiyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-ki-300/70 max-h-32 font-semibold shadow-xl ki-glow"
                    />
                    {/* Energy indicator */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-ki-500 to-transparent animate-aura-pulse pointer-events-none"></div>
                </div>

                {/* Send Button - Kamehameha style! */}
                <button
                    onClick={handleSubmit}
                    disabled={disabled || (!input.trim() && !selectedFile)}
                    className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-fire-600 via-saiyan-500 to-fire-600 hover:from-saiyan-600 hover:via-fire-500 hover:to-saiyan-600 flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 border-4 border-saiyan-400 shadow-2xl saiyan-glow relative overflow-hidden group"
                    title="KAMEHAMEHA! 💥"
                >
                    {/* Energy burst animation on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 group-hover:animate-energy-blast"></div>

                    <span className="text-3xl filter drop-shadow-lg relative z-10">
                        ⚡
                    </span>
                </button>
            </div>
        </div>
    )
}
