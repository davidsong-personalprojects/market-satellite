'use client'

import type { ResumeVersion } from '@/types'

interface Props {
  versions: ResumeVersion[]
  selectedVersionNumber: number
  onChange: (versionNumber: number) => void
}

export default function VersionSelector({ versions, selectedVersionNumber, onChange }: Props) {
  return (
    <select
      value={selectedVersionNumber}
      onChange={(e) => onChange(Number(e.target.value))}
      className="text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
    >
      {versions.map((v) => (
        <option key={v.id} value={v.versionNumber}>
          Version {v.versionNumber} \u2014 {new Date(v.createdAt).toLocaleString()}
        </option>
      ))}
    </select>
  )
}
