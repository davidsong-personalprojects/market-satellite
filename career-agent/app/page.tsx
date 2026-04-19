import { prisma } from '@/lib/prisma'
import ApplicationTable from '@/components/ApplicationTable'
import type { Application } from '@/types'

export default async function DashboardPage() {
  const applications = await prisma.application.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { versions: true } } },
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-6">Applications</h1>
      <ApplicationTable applications={applications as (Application & { _count: { versions: number } })[]} />
    </div>
  )
}
