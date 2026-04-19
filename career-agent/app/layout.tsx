import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Career Agent',
  description: 'AI-powered resume tailoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <span className="font-semibold text-gray-900">Career Agent</span>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">Applications</Link>
          <Link href="/master" className="text-sm text-gray-600 hover:text-gray-900">Master Resume</Link>
          <Link href="/apply/new" className="ml-auto text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            New Application
          </Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
