'use client'

interface Props {
  applicationId: number
  versionNumber: number
}

export default function ExportButtons({ applicationId, versionNumber }: Props) {
  const base = `/api/applications/${applicationId}/export`

  return (
    <div className="flex gap-2">
      <a
        href={`${base}/pdf?version=${versionNumber}`}
        download
        className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50"
      >
        Download PDF
      </a>
      <a
        href={`${base}/docx?version=${versionNumber}`}
        download
        className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50"
      >
        Download DOCX
      </a>
    </div>
  )
}
