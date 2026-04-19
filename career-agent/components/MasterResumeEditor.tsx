'use client'

import { useState } from 'react'

interface Props {
  initialContent: string
  updatedAt: string
}

export default function MasterResumeEditor({ initialContent, updatedAt }: Props) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/master', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const data = await res.json() as { updatedAt: string }
    setSavedAt(new Date(data.updatedAt).toLocaleTimeString())
    setSaving(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div className="text-sm text-gray-500">
          Last saved: {savedAt ?? new Date(updatedAt).toLocaleString()}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving\u2026' : 'Save'}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full p-6 font-mono text-sm resize-none outline-none bg-white"
        placeholder="Paste your full master resume in markdown here..."
        spellCheck={false}
      />
    </div>
  )
}
