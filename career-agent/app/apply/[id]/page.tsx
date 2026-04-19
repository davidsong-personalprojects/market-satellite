'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ResumeRenderer from '@/components/ui/ResumeRenderer'
import VersionSelector from '@/components/ui/VersionSelector'
import ExportButtons from '@/components/ui/ExportButtons'
import ChatPanel from '@/components/ui/ChatPanel'
import type { Application, ResumeVersion, ChatMessage } from '@/types'

export default function ApplicationWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const applicationId = Number(id)

  const [application, setApplication] = useState<Application | null>(null)
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedVersionNumber, setSelectedVersionNumber] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [appRes, versionsRes, messagesRes] = await Promise.all([
        fetch(`/api/applications/${applicationId}`),
        fetch(`/api/applications/${applicationId}/versions`),
        fetch(`/api/applications/${applicationId}/messages`),
      ])
      const [app, vers, msgs] = await Promise.all([
        appRes.json() as Promise<Application>,
        versionsRes.json() as Promise<ResumeVersion[]>,
        messagesRes.json() as Promise<ChatMessage[]>,
      ])
      setApplication(app)
      setVersions(vers)
      setMessages(msgs)
      if (vers.length > 0) {
        setSelectedVersionNumber(vers[vers.length - 1].versionNumber)
      }
      setLoading(false)
    }
    void load()
  }, [applicationId])

  function handleNewVersion(versionNumber: number, content: string) {
    const newVersion: ResumeVersion = {
      id: Date.now(),
      applicationId,
      versionNumber,
      content,
      createdAt: new Date().toISOString(),
    }
    setVersions((prev) => [...prev, newVersion])
    setSelectedVersionNumber(versionNumber)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[calc(100vh-56px)] text-gray-400">Loading\u2026</div>
  }

  if (!application) {
    return <div className="p-10 text-red-500">Application not found.</div>
  }

  const selectedVersion = versions.find((v) => v.versionNumber === selectedVersionNumber)

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <div className="flex-1 flex flex-col border-r border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
          <div>
            <span className="font-medium text-gray-900">{application.companyName}</span>
            <span className="text-gray-400 mx-2">\u00b7</span>
            <span className="text-gray-600 text-sm">{application.jobTitle}</span>
            <span className="ml-2 bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded">{application.industry}</span>
          </div>
          <div className="flex items-center gap-3">
            <VersionSelector
              versions={versions}
              selectedVersionNumber={selectedVersionNumber}
              onChange={setSelectedVersionNumber}
            />
            <ExportButtons applicationId={applicationId} versionNumber={selectedVersionNumber} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          {selectedVersion ? (
            <ResumeRenderer content={selectedVersion.content} />
          ) : (
            <p className="text-gray-400 text-sm">No resume generated yet.</p>
          )}
        </div>
      </div>

      <div className="w-80 flex flex-col bg-gray-50">
        <div className="px-4 py-3 border-b border-gray-200 text-sm font-medium text-gray-700">
          Iterate
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            applicationId={applicationId}
            onNewVersion={handleNewVersion}
          />
        </div>
      </div>
    </div>
  )
}
