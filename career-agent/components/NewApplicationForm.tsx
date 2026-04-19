'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { JdInputMode } from '@/types'

export default function NewApplicationForm() {
  const router = useRouter()
  const [mode, setMode] = useState<JdInputMode>('text')
  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [industry, setIndustry] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [jobText, setJobText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      let jobDescription = jobText
      if (mode === 'url') {
        const scrapeRes = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: jobUrl }),
        })
        if (!scrapeRes.ok) throw new Error('Failed to fetch job description from URL')
        const { text } = await scrapeRes.json() as { text: string }
        jobDescription = text
      }

      const createRes = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          jobTitle,
          industry,
          jobUrl: mode === 'url' ? jobUrl : undefined,
          jobDescription,
        }),
      })
      if (!createRes.ok) throw new Error('Failed to create application')
      const app = await createRes.json() as { id: number }

      const genRes = await fetch(`/api/applications/${app.id}/generate`, { method: 'POST' })
      if (!genRes.ok) throw new Error('Failed to generate resume')

      router.push(`/apply/${app.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-6 py-10 space-y-5">
      <h1 className="text-2xl font-semibold">New Application</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
        <input
          type="text"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Stripe"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
        <input
          type="text"
          required
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Staff Software Engineer"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
        <input
          type="text"
          required
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Fintech"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Job Description</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`text-sm px-3 py-1.5 rounded border ${mode === 'text' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}
          >
            Paste Text
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`text-sm px-3 py-1.5 rounded border ${mode === 'url' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}
          >
            Paste URL
          </button>
        </div>
        {mode === 'text' ? (
          <textarea
            required
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={10}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="Paste the full job description here..."
          />
        ) : (
          <input
            type="url"
            required
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://jobs.stripe.com/..."
          />
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white text-sm py-2.5 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Generating resume\u2026 this may take 30\u201360 seconds' : 'Create & Generate Resume'}
      </button>
    </form>
  )
}
