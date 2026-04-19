'use client'

import Link from 'next/link'
import type { Application } from '@/types'

interface Props {
  applications: (Application & { _count: { versions: number } })[]
}

export default function ApplicationTable({ applications }: Props) {
  if (applications.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        No applications yet.{' '}
        <Link href="/apply/new" className="text-blue-600 underline">Create your first one.</Link>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-200">
          <th className="py-3 pr-6 font-medium">Company</th>
          <th className="py-3 pr-6 font-medium">Role</th>
          <th className="py-3 pr-6 font-medium">Industry</th>
          <th className="py-3 pr-6 font-medium">Versions</th>
          <th className="py-3 font-medium">Created</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((app) => (
          <tr key={app.id} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="py-3 pr-6">
              <Link href={`/apply/${app.id}`} className="font-medium text-blue-600 hover:underline">
                {app.companyName}
              </Link>
            </td>
            <td className="py-3 pr-6 text-gray-700">{app.jobTitle}</td>
            <td className="py-3 pr-6">
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                {app.industry}
              </span>
            </td>
            <td className="py-3 pr-6 text-gray-600">{app._count.versions}</td>
            <td className="py-3 text-gray-500">
              {new Date(app.createdAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
