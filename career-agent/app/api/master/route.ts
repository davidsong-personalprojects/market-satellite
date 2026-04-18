// app/api/master/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const record = await prisma.masterResume.findUnique({ where: { id: 1 } })
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(record)
}

export async function PUT(request: Request) {
  const { content } = await request.json() as { content: string }
  if (typeof content !== 'string' || content.trim() === '') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  const record = await prisma.masterResume.upsert({
    where: { id: 1 },
    update: { content },
    create: { id: 1, content },
  })
  return NextResponse.json(record)
}
