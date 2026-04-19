'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  content: string
}

export default function ResumeRenderer({ content }: Props) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mt-5 mb-1 border-b border-gray-200 pb-1">{children}</h2>,
          ul: ({ children }) => <ul className="mt-1 mb-3 space-y-0.5">{children}</ul>,
          li: ({ children }) => <li className="text-sm text-gray-800 ml-4 list-disc">{children}</li>,
          p: ({ children }) => <p className="text-sm text-gray-800 mb-2">{children}</p>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
