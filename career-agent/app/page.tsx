import { prisma } from '@/lib/prisma'
import ApplicationTable from '@/components/ApplicationTable'
import type { Application } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const rows = await prisma.application.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { versions: true } } },
  })

  const applications: (Application & { _count: { versions: number } })[] = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    companyResearch: r.companyResearch as Application['companyResearch'],
  }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-6">Applications</h1>
      <ApplicationTable applications={applications} />
    </div>
  )
}
