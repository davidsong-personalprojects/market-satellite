// app/api/applications/[id]/iterate/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  anthropic,
  SYSTEM_PROMPT,
  buildIterateContext,
  parseIterationResponse,
} from '@/lib/claude'
import { Prisma } from '@prisma/client'
import type Anthropic from '@anthropic-ai/sdk'
import type { CompanyResearch } from '@/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const numId = Number(id)
  if (!Number.isInteger(numId) || numId < 1) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const applicationId = numId

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { userMessage } = body as { userMessage: unknown }
  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    return NextResponse.json({ error: 'userMessage is required' }, { status: 400 })
  }

  const [application, priorMessages, latestVersion] = await Promise.all([
    prisma.application.findUnique({ where: { id: applicationId } }),
    prisma.chatMessage.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.resumeVersion.findFirst({
      where: { applicationId },
      orderBy: { versionNumber: 'desc' },
    }),
  ])

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  if (!latestVersion) {
    return NextResponse.json({ error: 'No versions exist yet — run generate first' }, { status: 400 })
  }

  const systemContext = buildIterateContext({
    currentContent: latestVersion.content,
    versionNumber: latestVersion.versionNumber,
    jobDescription: application.jobDescription,
    // Prisma types companyResearch as JsonValue | null; cast to our typed interface.
    // We control what's written to this field — it's always CompanyResearch or null.
    companyResearch: application.companyResearch as CompanyResearch | null,
  })

  const claudeMessages: Anthropic.Messages.MessageParam[] = [
    ...priorMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ]

  let rawResponse: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: `${SYSTEM_PROMPT}\n\n---\n\n${systemContext}`,
      messages: claudeMessages,
    })

    rawResponse = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
  } catch (err) {
    console.error('Claude API error during iterate:', err)
    return NextResponse.json({ error: 'AI iteration failed' }, { status: 502 })
  }

  const { resumeMarkdown, changeSummary } = parseIterationResponse(rawResponse)

  // Use interactive transaction to compute versionNumber inside the transaction,
  // avoiding a race condition with concurrent iterate calls on the same application.
  const { newVersion } = await prisma.$transaction(async (tx) => {
    const agg = await tx.resumeVersion.aggregate({
      where: { applicationId },
      _max: { versionNumber: true },
    })
    const nextVersionNumber = (agg._max.versionNumber ?? 0) + 1

    const version = await tx.resumeVersion.create({
      data: { applicationId, versionNumber: nextVersionNumber, content: resumeMarkdown },
    })
    await tx.chatMessage.create({
      data: { applicationId, role: 'user', content: userMessage },
    })
    await tx.chatMessage.create({
      data: { applicationId, role: 'assistant', content: changeSummary || rawResponse },
    })
    return { newVersion: version }
  })

  return NextResponse.json({ version: newVersion, changeSummary })
}
