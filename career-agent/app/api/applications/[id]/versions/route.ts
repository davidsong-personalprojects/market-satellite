// app/api/applications/[id]/versions/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const versions = await prisma.resumeVersion.findMany({
    where: { applicationId: Number(id) },
    orderBy: { versionNumber: 'asc' },
  })
  return NextResponse.json(versions)
}
