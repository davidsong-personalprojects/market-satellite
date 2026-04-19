'use client'

import { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from '@/types'

interface Props {
  messages: ChatMessage[]
  applicationId: number
  onNewVersion: (versionNumber: number, content: string) => void
}

export default function ChatPanel({ messages: initialMessages, applicationId, onNewVersion }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || sending) return
    const userMessage = input.trim()
    setInput('')
    setSending(true)

    const optimisticUser: ChatMessage = {
      id: Date.now(),
      applicationId,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    try {
      const res = await fetch(`/api/applications/${applicationId}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
      })
      const data = await res.json() as {
        version: { versionNumber: number; content: string }
        changeSummary: string
      }

      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        applicationId,
        role: 'assistant',
        content: data.changeSummary || 'Resume updated.',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      onNewVersion(data.version.versionNumber, data.version.content)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">
            Give feedback to iterate on the resume.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm rounded px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-blue-50 text-blue-900 ml-6'
                : 'bg-gray-100 text-gray-800 mr-6'
            }`}
          >
            <p className="text-xs font-medium mb-1 opacity-60">
              {msg.role === 'user' ? 'You' : 'Claude'}
            </p>
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
          rows={2}
          placeholder="e.g. Make the summary punchier, cut the internship section\u2026"
          className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-blue-500"
          disabled={sending}
        />
        <button
          onClick={() => void handleSend()}
          disabled={sending || !input.trim()}
          className="self-end bg-blue-600 text-white text-sm px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? '\u2026' : 'Send'}
        </button>
      </div>
    </div>
  )
}
