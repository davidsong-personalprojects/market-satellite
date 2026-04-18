// app/api/applications/[id]/messages/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const messages = await prisma.chatMessage.findMany({
    where: { applicationId: Number(id) },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(messages)
}
