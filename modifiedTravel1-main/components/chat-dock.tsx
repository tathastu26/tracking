'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Maximize2, Minimize2 } from 'lucide-react'

// Simple markdown parser for chat messages
function parseMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg font-bold mb-2">{line.substring(2)}</h1>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-bold mb-2">{line.substring(3)}</h2>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="font-bold mb-1">{line.substring(4)}</h3>
      )
    } else if (line.trim()) {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')

      elements.push(
        <p key={`p-${i}`} className="mb-2" dangerouslySetInnerHTML={{ __html: formatted }} />
      )
    } else {
      elements.push(<br key={`br-${i}`} />)
    }

    i++
  }

  return elements
}

export function ChatDock() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [messages, setMessages] = React.useState<
    Array<{ id: string; role: 'user' | 'assistant'; text: string }>
  >([
    {
      id: '1',
      role: 'assistant',
      text: '# 👋 Welcome!\n\nI\'m your **Flight Operations Assistant**. I can help you with:\n\n- ✈️ Flight information and scheduling\n- 🗺️ Route planning and optimization\n- 📍 Airport details and locations\n- 🛫 Travel itinerary management\n- 💼 Operational support\n\n**How can I assist you today?**',
    },
  ])
  const [input, setInput] = React.useState('')
  const [isSending, setIsSending] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  React.useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isSending) return

    const newMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      text: input,
    }

    setMessages((prev) => [...prev, newMessage])
    setInput('')

    setIsSending(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, newMessage] }),
      })

      if (!response.ok) throw new Error('Failed to get assistant response')

      const data = await response.json()
      const assistantText =
        data?.reply ||
        '❌ **Error:** No response received from assistant. Please try again.'

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-assistant`, role: 'assistant', text: assistantText },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          text: '⚠️ **Connection Error:** Could not reach OpenRouter. Please try again in a moment.',
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-14 h-14 bg-primary text-primary-foreground rounded-md flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow z-40"
        aria-label="Open AI assistant"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`${
              isFullscreen
                ? 'fixed inset-0 z-50 rounded-none'
                : 'fixed inset-x-3 top-16 bottom-20 z-50 md:inset-x-auto md:right-6 md:top-auto md:bottom-24 md:w-96 md:h-[calc(100vh-7rem)] md:max-h-[600px]'
            } bg-zinc-950 border border-zinc-800 rounded shadow-2xl flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className="px-4 py-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Flight AI Assistant</h3>
                <p className="text-xs text-muted-foreground">Always here to help</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 hover:bg-muted rounded transition-colors"
                  title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => { setIsOpen(false); setIsFullscreen(false) }}
                  className="p-1.5 hover:bg-muted rounded transition-colors"
                  title="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              className={`flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950 ${
                isFullscreen ? 'max-h-[calc(100vh-140px)]' : ''
              }`}
            >
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-xs px-4 py-3 rounded-lg text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground border border-border/50'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {parseMarkdown(message.text)}
                      </div>
                    ) : (
                      <p>{message.text}</p>
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-4 border-t border-zinc-800 bg-zinc-900/60 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isSending}
              />
              <button
                onClick={handleSend}
                className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-60"
                aria-label="Send message"
                disabled={isSending || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Fullscreen backdrop */}
            {isFullscreen && (
              <div
                className="fixed inset-0 bg-black/20 -z-10"
                onClick={() => setIsFullscreen(false)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}