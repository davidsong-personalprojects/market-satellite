// app/api/applications/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const applications = await prisma.application.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { versions: true } } },
  })
  return NextResponse.json(applications)
}

export async function POST(request: Request) {
  const body = await request.json() as {
    companyName: string
    jobTitle: string
    industry: string
    jobUrl?: string
    jobDescription: string
  }

  const { companyName, jobTitle, industry, jobUrl, jobDescription } = body

  if (!companyName || !jobTitle || !industry || !jobDescription) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const application = await prisma.application.create({
    data: { companyName, jobTitle, industry, jobUrl: jobUrl ?? null, jobDescription },
  })

  return NextResponse.json(application, { status: 201 })
}
