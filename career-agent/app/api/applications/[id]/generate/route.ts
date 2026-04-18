// app/api/applications/[id]/generate/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  anthropic,
  SYSTEM_PROMPT,
  buildGenerateMessage,
  extractResumePart,
  extractCompanyResearchFromToolResults,
} from '@/lib/claude'
import type Anthropic from '@anthropic-ai/sdk'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const numId = Number(id)
  if (!Number.isInteger(numId) || numId < 1) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const applicationId = numId

  const [application, masterResume] = await Promise.all([
    prisma.application.findUnique({ where: { id: applicationId } }),
    prisma.masterResume.findUnique({ where: { id: 1 } }),
  ])

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  if (!masterResume) {
    return NextResponse.json({ error: 'Master resume not set' }, { status: 400 })
  }

  const userMessage = buildGenerateMessage({
    companyName: application.companyName,
    jobTitle: application.jobTitle,
    jobDescription: application.jobDescription,
    masterResumeContent: masterResume.content,
  })

  // Agentic tool-use loop: Claude may call web_search multiple times
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: userMessage },
  ]
  const collectedToolResults: Anthropic.Messages.ToolResultBlockParam[] = []

  let finalText = ''

  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'web_search',
          description: 'Search the web for information about a company or topic',
          input_schema: {
            type: 'object' as const,
            properties: {
              query: { type: 'string', description: 'The search query' },
            },
            required: ['query'],
          },
        },
      ],
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      finalText = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
      )

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const input = block.input as { query: string }
          const searchResult = await performWebSearch(input.query)
          const resultBlock: Anthropic.Messages.ToolResultBlockParam = {
            type: 'tool_result',
            tool_use_id: block.id,
            content: searchResult,
          }
          collectedToolResults.push(resultBlock)
          return resultBlock
        })
      )

      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Unexpected stop reason — break to avoid infinite loop
    break
  }

  const resumeContent = extractResumePart(finalText)
  const companyResearch = extractCompanyResearchFromToolResults(collectedToolResults)

  const existingVersionCount = await prisma.resumeVersion.count({
    where: { applicationId },
  })

  const [version] = await prisma.$transaction([
    prisma.resumeVersion.create({
      data: {
        applicationId,
        versionNumber: existingVersionCount + 1,
        content: resumeContent,
      },
    }),
    prisma.application.update({
      where: { id: applicationId },
      // CompanyResearch satisfies InputJsonValue at runtime; cast required because
      // Prisma's InputJsonObject demands an index signature our interface omits.
      data: { companyResearch: companyResearch as unknown as Prisma.InputJsonValue },
    }),
    prisma.chatMessage.create({
      data: {
        applicationId,
        role: 'assistant',
        content: finalText,
      },
    }),
  ])

  return NextResponse.json({ version, companyResearch })
}

async function performWebSearch(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)
    try {
      const res = await fetch(url, { signal: controller.signal })
      const data = await res.json() as { AbstractText?: string; RelatedTopics?: { Text?: string }[] }
      const abstract = data.AbstractText ?? ''
      const related = (data.RelatedTopics ?? [])
        .slice(0, 3)
        .map((t) => t.Text ?? '')
        .filter(Boolean)
        .join('\n')
      return [abstract, related].filter(Boolean).join('\n') || `No results found for: ${query}`
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return `Search unavailable for: ${query}`
  }
}
