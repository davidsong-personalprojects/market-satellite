// lib/claude.ts
import Anthropic from '@anthropic-ai/sdk'
import type { CompanyResearch } from '@/types'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const SYSTEM_PROMPT = `You are an expert resume strategist with deep knowledge of hiring practices across industries. You write resumes that pass ATS filters and impress human reviewers.

Resume writing standards you always apply:
- Every bullet is intentional: typically 3–5 per role, fewer for older or less relevant positions
- Each bullet earns its place by serving a clear strategic purpose: quantified achievement, skill signal, or leadership evidence
- All bullets use XYZ format: "Accomplished X by doing Y, resulting in Z"
- Bullet count, purpose, theme, and content across each role form a coherent narrative aimed at the target position
- ATS-optimized language that mirrors the job description's keywords
- One page by default — only exceed if the role clearly warrants it (senior technical, publications, etc.)
- Never pad, never generalize, flag gaps honestly

When iterating on feedback, respond with the updated resume markdown first, then a delimiter line containing only "---CHANGES---", then a plain-text bullet list summarizing exactly what changed.`

export function buildGenerateMessage({
  companyName,
  jobTitle,
  jobDescription,
  masterResumeContent,
}: {
  companyName: string
  jobTitle: string
  jobDescription: string
  masterResumeContent: string
}): string {
  return `Company: ${companyName}
Role: ${jobTitle}

Job Description:
${jobDescription}

Master Resume:
${masterResumeContent}

Instructions:
1. Use web_search to research ${companyName}: mission, culture, tech stack, team structure, recent news. Gather enough context to inform tailoring decisions.
2. Select and rewrite experience, skills, and achievements from the master resume that are most relevant to this role and company.
3. Apply industry best practices: strategic bullet count per role, XYZ format, ATS-optimized language mirroring the JD's keywords.
4. Include a "## Gap Analysis" section at the end listing skills or experiences the JD requires that are absent or weak in the master resume.
5. Output the tailored resume in clean markdown using standard section headers (## Experience, ## Skills, etc.).`
}

export function buildIterateContext({
  currentContent,
  versionNumber,
  jobDescription,
  companyResearch,
}: {
  currentContent: string
  versionNumber: number
  jobDescription: string
  companyResearch: CompanyResearch | null
}): string {
  return `Current Resume (Version ${versionNumber}):
${currentContent}

Original Job Description:
${jobDescription}

Company Research:
${JSON.stringify(companyResearch ?? {}, null, 2)}`
}

export function parseIterationResponse(raw: string): {
  resumeMarkdown: string
  changeSummary: string
} {
  const delimiterIndex = raw.indexOf('---CHANGES---')
  if (delimiterIndex === -1) {
    return { resumeMarkdown: raw, changeSummary: '' }
  }
  return {
    resumeMarkdown: raw.slice(0, delimiterIndex).trim(),
    changeSummary: raw.slice(delimiterIndex + '---CHANGES---'.length).trim(),
  }
}

export function extractResumePart(fullResponse: string): string {
  const gapIndex = fullResponse.indexOf('## Gap Analysis')
  return gapIndex !== -1 ? fullResponse.slice(0, gapIndex).trim() : fullResponse.trim()
}

export function extractCompanyResearchFromToolResults(
  toolResults: Anthropic.Messages.ToolResultBlockParam[]
): CompanyResearch {
  const rawSources = toolResults
    .map((r) => {
      if (typeof r.content === 'string') return r.content
      if (Array.isArray(r.content)) {
        return r.content
          .filter((b): b is Anthropic.Messages.TextBlockParam => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
      }
      return ''
    })
    .filter(Boolean)

  return {
    summary: rawSources.slice(0, 3).join('\n\n').slice(0, 2000),
    mission: '',
    techStack: [],
    culture: '',
    recentNews: [],
    rawSources,
  }
}
