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
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { companyName, jobTitle, industry, jobUrl, jobDescription } = body as {
    companyName: string
    jobTitle: string
    industry: string
    jobUrl?: string
    jobDescription: string
  }

  if (
    typeof companyName !== 'string' || !companyName.trim() ||
    typeof jobTitle !== 'string' || !jobTitle.trim() ||
    typeof industry !== 'string' || !industry.trim() ||
    typeof jobDescription !== 'string' || !jobDescription.trim()
  ) {
    return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 })
  }

  const application = await prisma.application.create({
    data: { companyName: companyName.trim(), jobTitle: jobTitle.trim(), industry: industry.trim(), jobUrl: jobUrl ?? null, jobDescription },
  })

  return NextResponse.json(application, { status: 201 })
}
