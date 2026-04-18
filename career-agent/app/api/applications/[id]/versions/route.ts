// app/api/applications/[id]/versions/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const numId = Number(id)
  if (!Number.isInteger(numId) || numId < 1) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const versions = await prisma.resumeVersion.findMany({
    where: { applicationId: numId },
    orderBy: { versionNumber: 'asc' },
  })
  return NextResponse.json(versions)
}
