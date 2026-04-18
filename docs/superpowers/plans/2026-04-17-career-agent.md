# Career Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user web app that stores an evergreen master resume and uses Claude to generate, version, and iteratively refine tailored resumes for each job application — with PDF and DOCX export.

**Architecture:** Standalone Next.js App Router app with Neon Postgres via Prisma. Claude API (`claude-sonnet-4-6`) handles tailoring with web_search for company research. Four DB entities: MasterResume, Application, ResumeVersion, ChatMessage. Three pages: dashboard, master editor, application workspace. API routes handle all DB and AI operations server-side.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, Prisma + Neon Postgres, @anthropic-ai/sdk, @react-pdf/renderer, docx, react-markdown, cheerio, Vitest

---

## File Map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | DB schema: MasterResume, Application, ResumeVersion, ChatMessage |
| `lib/prisma.ts` | Prisma singleton with Neon adapter |
| `types/index.ts` | All shared TypeScript types and interfaces |
| `lib/scraper.ts` | Fetch a URL and extract readable text (JD extraction) |
| `lib/claude.ts` | Claude API client, system prompt, prompt builders for generate + iterate |
| `lib/export.ts` | Markdown → PDF buffer and markdown → DOCX buffer |
| `app/api/master/route.ts` | GET + PUT master resume |
| `app/api/applications/route.ts` | GET list + POST create application |
| `app/api/applications/[id]/route.ts` | GET single application |
| `app/api/applications/[id]/versions/route.ts` | GET version list for an application |
| `app/api/applications/[id]/generate/route.ts` | POST initial resume generation |
| `app/api/applications/[id]/iterate/route.ts` | POST iterate on feedback |
| `app/api/applications/[id]/export/pdf/route.ts` | GET download PDF for a version |
| `app/api/applications/[id]/export/docx/route.ts` | GET download DOCX for a version |
| `app/layout.tsx` | Root layout with nav |
| `app/page.tsx` | Dashboard — application list |
| `app/master/page.tsx` | Master resume editor page |
| `app/apply/new/page.tsx` | New application form page |
| `app/apply/[id]/page.tsx` | Application workspace page |
| `components/ApplicationTable.tsx` | Table of applications with tags |
| `components/MasterResumeEditor.tsx` | Controlled textarea + save button |
| `components/NewApplicationForm.tsx` | Form with URL/text toggle for JD input |
| `components/ui/ResumeRenderer.tsx` | Renders markdown resume as formatted HTML |
| `components/ui/VersionSelector.tsx` | Dropdown to switch between resume versions |
| `components/ui/ChatPanel.tsx` | Chat history + input for iteration |
| `components/ui/ExportButtons.tsx` | PDF + DOCX download buttons |

---

## Task 1: Scaffold Project

**Files:**
- Create: `career-agent/` (new Next.js project)
- Create: `career-agent/.env.local`

- [ ] **Step 1: Scaffold Next.js app**

Run from `/Users/davidsong/Documents/Claude Code Doc/`:
```bash
npx create-next-app@latest career-agent \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --no-turbopack \
  --import-alias "@/*"
cd career-agent
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk @prisma/client @prisma/adapter-neon @neondatabase/serverless
npm install react-markdown remark-gfm
npm install @react-pdf/renderer
npm install docx
npm install cheerio
npm install -D prisma vitest @vitejs/plugin-react jsdom @testing-library/react @types/cheerio
```

- [ ] **Step 3: Create `.env.local`**

```bash
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://..."   # your Neon connection string
ANTHROPIC_API_KEY="sk-ant-..."    # your Anthropic API key
EOF
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 5: Add test script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold career-agent Next.js project"
```

---

## Task 2: Prisma Schema + DB Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write schema**

Replace `prisma/schema.prisma` with:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model MasterResume {
  id        Int      @id @default(1)
  content   String
  updatedAt DateTime @updatedAt
}

model Application {
  id              Int             @id @default(autoincrement())
  companyName     String
  jobTitle        String
  industry        String
  jobUrl          String?
  jobDescription  String
  companyResearch Json?
  createdAt       DateTime        @default(now())
  versions        ResumeVersion[]
  messages        ChatMessage[]
}

model ResumeVersion {
  id            Int         @id @default(autoincrement())
  applicationId Int
  versionNumber Int
  content       String
  createdAt     DateTime    @default(now())
  application   Application @relation(fields: [applicationId], references: [id])
}

model ChatMessage {
  id            Int         @id @default(autoincrement())
  applicationId Int
  role          MessageRole
  content       String
  createdAt     DateTime    @default(now())
  application   Application @relation(fields: [applicationId], references: [id])
}

enum MessageRole {
  user
  assistant
}
```

- [ ] **Step 3: Push schema to Neon**

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Create `lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neon } from '@neondatabase/serverless'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const sql = neon(process.env.DATABASE_URL!)
  const adapter = new PrismaNeon(sql)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 5: Seed the MasterResume row**

```bash
npx prisma studio
```

Or run this one-time seed via a quick script:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const adapter = new PrismaNeon(sql);
const prisma = new PrismaClient({ adapter });
prisma.masterResume.upsert({
  where: { id: 1 },
  update: {},
  create: { id: 1, content: '# My Resume\n\nPaste your full resume here.' }
}).then(() => { console.log('Seeded'); process.exit(0); });
"
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma lib/prisma.ts
git commit -m "feat: add Prisma schema and Neon client"
```

---

## Task 3: Shared Types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Write types**

```typescript
// types/index.ts

export interface MasterResume {
  id: number
  content: string
  updatedAt: string
}

export interface Application {
  id: number
  companyName: string
  jobTitle: string
  industry: string
  jobUrl: string | null
  jobDescription: string
  companyResearch: CompanyResearch | null
  createdAt: string
  _count?: { versions: number }
}

export interface CompanyResearch {
  summary: string
  mission: string
  techStack: string[]
  culture: string
  recentNews: string[]
  rawSources: string[]
}

export interface ResumeVersion {
  id: number
  applicationId: number
  versionNumber: number
  content: string
  createdAt: string
}

export interface ChatMessage {
  id: number
  applicationId: number
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type JdInputMode = 'url' | 'text'
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Master Resume API

**Files:**
- Create: `app/api/master/route.ts`

- [ ] **Step 1: Write the route**

```typescript
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
```

- [ ] **Step 2: Smoke test**

```bash
npm run dev &
curl http://localhost:3000/api/master
# Expected: { id: 1, content: "# My Resume...", updatedAt: "..." }
curl -X PUT http://localhost:3000/api/master \
  -H "Content-Type: application/json" \
  -d '{"content":"# Test"}'
# Expected: { id: 1, content: "# Test", updatedAt: "..." }
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add app/api/master/route.ts
git commit -m "feat: add master resume GET and PUT API"
```

---

## Task 5: Applications List + Create API

**Files:**
- Create: `app/api/applications/route.ts`

- [ ] **Step 1: Write the route**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/applications/route.ts
git commit -m "feat: add applications list and create API"
```

---

## Task 6: Application Detail + Versions API

**Files:**
- Create: `app/api/applications/[id]/route.ts`
- Create: `app/api/applications/[id]/versions/route.ts`

- [ ] **Step 1: Write application detail route**

```typescript
// app/api/applications/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const application = await prisma.application.findUnique({
    where: { id: Number(id) },
    include: { _count: { select: { versions: true } } },
  })
  if (!application) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(application)
}
```

- [ ] **Step 2: Write versions route**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add app/api/applications/[id]/route.ts app/api/applications/[id]/versions/route.ts
git commit -m "feat: add application detail and versions API"
```

---

## Task 7: JD Scraper

**Files:**
- Create: `lib/scraper.ts`
- Create: `lib/scraper.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// lib/scraper.test.ts
import { describe, it, expect } from 'vitest'
import { extractText } from './scraper'

describe('extractText', () => {
  it('extracts visible text from HTML, stripping tags and collapsing whitespace', () => {
    const html = `
      <html>
        <head><title>Job</title><script>alert(1)</script></head>
        <body>
          <nav>Home | About</nav>
          <main>
            <h1>Software Engineer</h1>
            <p>We are looking for a skilled engineer.</p>
            <ul><li>5+ years experience</li><li>TypeScript</li></ul>
          </main>
          <footer>Copyright 2026</footer>
        </body>
      </html>
    `
    const result = extractText(html)
    expect(result).toContain('Software Engineer')
    expect(result).toContain('5+ years experience')
    expect(result).toContain('TypeScript')
    expect(result).not.toContain('alert(1)')
  })

  it('returns empty string for empty HTML', () => {
    expect(extractText('')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm test lib/scraper.test.ts
```

Expected: FAIL — `extractText` is not defined.

- [ ] **Step 3: Implement `lib/scraper.ts`**

```typescript
// lib/scraper.ts
import * as cheerio from 'cheerio'

export function extractText(html: string): string {
  if (!html) return ''
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript').remove()
  const text = $('body').text()
  return text.replace(/\s+/g, ' ').trim()
}

export async function fetchJobDescription(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; career-agent/1.0)' },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }
  const html = await response.text()
  return extractText(html)
}
```

- [ ] **Step 4: Run test to confirm pass**

```bash
npm test lib/scraper.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/scraper.ts lib/scraper.test.ts
git commit -m "feat: add JD scraper with cheerio text extraction"
```

---

## Task 8: Claude Client + Prompt Builders

**Files:**
- Create: `lib/claude.ts`
- Create: `lib/claude.test.ts`

- [ ] **Step 1: Write failing tests for prompt builders**

```typescript
// lib/claude.test.ts
import { describe, it, expect } from 'vitest'
import { buildGenerateMessage, buildIterateContext, parseIterationResponse } from './claude'

describe('buildGenerateMessage', () => {
  it('includes company, role, JD, and master resume in the message', () => {
    const msg = buildGenerateMessage({
      companyName: 'Stripe',
      jobTitle: 'Staff Engineer',
      jobDescription: 'We need a great engineer.',
      masterResumeContent: '## Experience\n- Built things',
    })
    expect(msg).toContain('Stripe')
    expect(msg).toContain('Staff Engineer')
    expect(msg).toContain('We need a great engineer.')
    expect(msg).toContain('## Experience')
  })
})

describe('buildIterateContext', () => {
  it('includes current version, JD, and company research', () => {
    const ctx = buildIterateContext({
      currentContent: '# Resume',
      versionNumber: 2,
      jobDescription: 'Great job',
      companyResearch: { summary: 'Fintech co', mission: '', techStack: [], culture: '', recentNews: [], rawSources: [] },
    })
    expect(ctx).toContain('Version 2')
    expect(ctx).toContain('# Resume')
    expect(ctx).toContain('Great job')
    expect(ctx).toContain('Fintech co')
  })
})

describe('parseIterationResponse', () => {
  it('splits on ---CHANGES--- delimiter', () => {
    const raw = '# Resume\n\nBullet\n---CHANGES---\n- Made bullet stronger'
    const { resumeMarkdown, changeSummary } = parseIterationResponse(raw)
    expect(resumeMarkdown.trim()).toBe('# Resume\n\nBullet')
    expect(changeSummary.trim()).toBe('- Made bullet stronger')
  })

  it('returns full response as resume if no delimiter present', () => {
    const raw = '# Resume content only'
    const { resumeMarkdown, changeSummary } = parseIterationResponse(raw)
    expect(resumeMarkdown).toBe('# Resume content only')
    expect(changeSummary).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm test lib/claude.test.ts
```

Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement `lib/claude.ts`**

```typescript
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
    .map((r) => (typeof r.content === 'string' ? r.content : JSON.stringify(r.content)))
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
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test lib/claude.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/claude.ts lib/claude.test.ts
git commit -m "feat: add Claude client, prompt builders, and response parser"
```

---

## Task 9: Generate API Route

**Files:**
- Create: `app/api/applications/[id]/generate/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// app/api/applications/[id]/generate/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
  const applicationId = Number(id)

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
          // Perform actual web search via a simple DuckDuckGo API or return placeholder
          // NOTE: Replace with a real search API key/integration if needed
          const searchResult = await performWebSearch(input.query)
          collectedToolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: searchResult,
          })
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: searchResult,
          }
        })
      )

      messages.push({ role: 'user', content: toolResults })
      continue
    }

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
      data: { companyResearch },
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
    const res = await fetch(url)
    const data = await res.json() as { AbstractText?: string; RelatedTopics?: { Text?: string }[] }
    const abstract = data.AbstractText ?? ''
    const related = (data.RelatedTopics ?? [])
      .slice(0, 3)
      .map((t) => t.Text ?? '')
      .filter(Boolean)
      .join('\n')
    return [abstract, related].filter(Boolean).join('\n') || `No results found for: ${query}`
  } catch {
    return `Search unavailable for: ${query}`
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/applications/[id]/generate/route.ts
git commit -m "feat: add initial resume generation API with web_search tool use"
```

---

## Task 10: Iterate API Route

**Files:**
- Create: `app/api/applications/[id]/iterate/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// app/api/applications/[id]/iterate/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  anthropic,
  SYSTEM_PROMPT,
  buildIterateContext,
  parseIterationResponse,
} from '@/lib/claude'
import type Anthropic from '@anthropic-ai/sdk'
import type { CompanyResearch } from '@/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const applicationId = Number(id)
  const { userMessage } = await request.json() as { userMessage: string }

  if (!userMessage?.trim()) {
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
    companyResearch: application.companyResearch as CompanyResearch | null,
  })

  const claudeMessages: Anthropic.Messages.MessageParam[] = [
    ...priorMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: `${SYSTEM_PROMPT}\n\n---\n\n${systemContext}`,
    messages: claudeMessages,
  })

  const rawResponse = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  const { resumeMarkdown, changeSummary } = parseIterationResponse(rawResponse)

  const newVersionNumber = latestVersion.versionNumber + 1

  const [newVersion] = await prisma.$transaction([
    prisma.resumeVersion.create({
      data: {
        applicationId,
        versionNumber: newVersionNumber,
        content: resumeMarkdown,
      },
    }),
    prisma.chatMessage.create({
      data: { applicationId, role: 'user', content: userMessage },
    }),
    prisma.chatMessage.create({
      data: { applicationId, role: 'assistant', content: changeSummary || rawResponse },
    }),
  ])

  return NextResponse.json({ version: newVersion, changeSummary })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/applications/[id]/iterate/route.ts
git commit -m "feat: add resume iteration API with chat history"
```

---

## Task 11: Export Lib + API Routes

**Files:**
- Create: `lib/export.ts`
- Create: `app/api/applications/[id]/export/pdf/route.ts`
- Create: `app/api/applications/[id]/export/docx/route.ts`

- [ ] **Step 1: Write `lib/export.ts`**

```typescript
// lib/export.ts
import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from 'docx'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { Page, Text, View, Document as PDFDocument, StyleSheet, Font } from '@react-pdf/renderer'

const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#111' },
  heading1: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  heading2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 2 },
  paragraph: { marginBottom: 3, lineHeight: 1.4 },
  bullet: { marginBottom: 2, paddingLeft: 12, lineHeight: 1.4 },
})

function parseMarkdownToPDFElements(markdown: string) {
  const lines = markdown.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('# ')) {
      return createElement(Text, { key: i, style: pdfStyles.heading1 }, line.slice(2))
    }
    if (line.startsWith('## ')) {
      return createElement(Text, { key: i, style: pdfStyles.heading2 }, line.slice(3))
    }
    if (line.startsWith('- ')) {
      return createElement(Text, { key: i, style: pdfStyles.bullet }, `• ${line.slice(2)}`)
    }
    if (line.trim() === '') return null
    return createElement(Text, { key: i, style: pdfStyles.paragraph }, line)
  }).filter(Boolean)
}

export async function generatePDF(markdownContent: string): Promise<Buffer> {
  const elements = parseMarkdownToPDFElements(markdownContent)
  const doc = createElement(
    PDFDocument,
    null,
    createElement(Page, { size: 'LETTER', style: pdfStyles.page },
      createElement(View, null, ...elements)
    )
  )
  return Buffer.from(await renderToBuffer(doc))
}

function parseMarkdownToDocxParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split('\n')
  return lines.map((line) => {
    if (line.startsWith('# ')) {
      return new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 })
    }
    if (line.startsWith('## ')) {
      return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 })
    }
    if (line.startsWith('- ')) {
      return new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun(line.slice(2))],
      })
    }
    if (line.trim() === '') {
      return new Paragraph({ text: '' })
    }
    return new Paragraph({ children: [new TextRun(line)] })
  })
}

export async function generateDOCX(markdownContent: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: parseMarkdownToDocxParagraphs(markdownContent) }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}

export function safeFilename(companyName: string, jobTitle: string, versionNumber: number, ext: string): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
  return `${clean(companyName)}_${clean(jobTitle)}_v${versionNumber}.${ext}`
}
```

- [ ] **Step 2: Write PDF export route**

```typescript
// app/api/applications/[id]/export/pdf/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePDF, safeFilename } from '@/lib/export'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const versionNumber = Number(searchParams.get('version') ?? '1')

  const [application, version] = await Promise.all([
    prisma.application.findUnique({ where: { id: Number(id) } }),
    prisma.resumeVersion.findFirst({
      where: { applicationId: Number(id), versionNumber },
    }),
  ])

  if (!application || !version) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const buffer = await generatePDF(version.content)
  const filename = safeFilename(application.companyName, application.jobTitle, versionNumber, 'pdf')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 3: Write DOCX export route**

```typescript
// app/api/applications/[id]/export/docx/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateDOCX, safeFilename } from '@/lib/export'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const versionNumber = Number(searchParams.get('version') ?? '1')

  const [application, version] = await Promise.all([
    prisma.application.findUnique({ where: { id: Number(id) } }),
    prisma.resumeVersion.findFirst({
      where: { applicationId: Number(id), versionNumber },
    }),
  ])

  if (!application || !version) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const buffer = await generateDOCX(version.content)
  const filename = safeFilename(application.companyName, application.jobTitle, versionNumber, 'docx')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/export.ts \
  app/api/applications/[id]/export/pdf/route.ts \
  app/api/applications/[id]/export/docx/route.ts
git commit -m "feat: add PDF and DOCX export lib and routes"
```

---

## Task 12: Root Layout + Nav

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Update `app/layout.tsx`**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Career Agent',
  description: 'AI-powered resume tailoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <span className="font-semibold text-gray-900">Career Agent</span>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">Applications</Link>
          <Link href="/master" className="text-sm text-gray-600 hover:text-gray-900">Master Resume</Link>
          <Link href="/apply/new" className="ml-auto text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            New Application
          </Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Strip dark mode from `app/globals.css`**

Replace the contents of `app/globals.css` with:
```css
@import "tailwindcss";

* {
  box-sizing: border-box;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: add root layout with nav"
```

---

## Task 13: ApplicationTable Component + Dashboard Page

**Files:**
- Create: `components/ApplicationTable.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/ApplicationTable.tsx`**

```typescript
// components/ApplicationTable.tsx
'use client'

import Link from 'next/link'
import type { Application } from '@/types'

interface Props {
  applications: (Application & { _count: { versions: number } })[]
}

export default function ApplicationTable({ applications }: Props) {
  if (applications.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        No applications yet.{' '}
        <Link href="/apply/new" className="text-blue-600 underline">Create your first one.</Link>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-200">
          <th className="py-3 pr-6 font-medium">Company</th>
          <th className="py-3 pr-6 font-medium">Role</th>
          <th className="py-3 pr-6 font-medium">Industry</th>
          <th className="py-3 pr-6 font-medium">Versions</th>
          <th className="py-3 font-medium">Created</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((app) => (
          <tr key={app.id} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="py-3 pr-6">
              <Link href={`/apply/${app.id}`} className="font-medium text-blue-600 hover:underline">
                {app.companyName}
              </Link>
            </td>
            <td className="py-3 pr-6 text-gray-700">{app.jobTitle}</td>
            <td className="py-3 pr-6">
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                {app.industry}
              </span>
            </td>
            <td className="py-3 pr-6 text-gray-600">{app._count.versions}</td>
            <td className="py-3 text-gray-500">
              {new Date(app.createdAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Write `app/page.tsx`**

```typescript
// app/page.tsx
import { prisma } from '@/lib/prisma'
import ApplicationTable from '@/components/ApplicationTable'
import type { Application } from '@/types'

export default async function DashboardPage() {
  const applications = await prisma.application.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { versions: true } } },
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-6">Applications</h1>
      <ApplicationTable applications={applications as (Application & { _count: { versions: number } })[]} />
    </div>
  )
}
```

- [ ] **Step 3: Start dev server and verify dashboard loads**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Expect: nav bar + empty applications table with "Create your first one" link.

- [ ] **Step 4: Commit**

```bash
git add components/ApplicationTable.tsx app/page.tsx
git commit -m "feat: add dashboard page with application table"
```

---

## Task 14: Master Resume Editor

**Files:**
- Create: `components/MasterResumeEditor.tsx`
- Create: `app/master/page.tsx`

- [ ] **Step 1: Create `components/MasterResumeEditor.tsx`**

```typescript
// components/MasterResumeEditor.tsx
'use client'

import { useState } from 'react'

interface Props {
  initialContent: string
  updatedAt: string
}

export default function MasterResumeEditor({ initialContent, updatedAt }: Props) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/master', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const data = await res.json() as { updatedAt: string }
    setSavedAt(new Date(data.updatedAt).toLocaleTimeString())
    setSaving(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div className="text-sm text-gray-500">
          Last saved: {savedAt ?? new Date(updatedAt).toLocaleString()}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full p-6 font-mono text-sm resize-none outline-none bg-white"
        placeholder="Paste your full master resume in markdown here..."
        spellCheck={false}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `app/master/page.tsx`**

```typescript
// app/master/page.tsx
import { prisma } from '@/lib/prisma'
import MasterResumeEditor from '@/components/MasterResumeEditor'

export default async function MasterPage() {
  const record = await prisma.masterResume.findUnique({ where: { id: 1 } })
  const content = record?.content ?? ''
  const updatedAt = record?.updatedAt.toISOString() ?? new Date().toISOString()

  return <MasterResumeEditor initialContent={content} updatedAt={updatedAt} />
}
```

- [ ] **Step 3: Verify in browser**

Navigate to [http://localhost:3000/master](http://localhost:3000/master). Expect: full-height textarea with placeholder text and Save button. Type something, click Save, verify "Last saved" timestamp updates.

- [ ] **Step 4: Commit**

```bash
git add components/MasterResumeEditor.tsx app/master/page.tsx
git commit -m "feat: add master resume editor page"
```

---

## Task 15: New Application Form

**Files:**
- Create: `components/NewApplicationForm.tsx`
- Create: `app/apply/new/page.tsx`

- [ ] **Step 1: Create `components/NewApplicationForm.tsx`**

```typescript
// components/NewApplicationForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { JdInputMode } from '@/types'

export default function NewApplicationForm() {
  const router = useRouter()
  const [mode, setMode] = useState<JdInputMode>('text')
  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [industry, setIndustry] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [jobText, setJobText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // 1. Resolve job description text
      let jobDescription = jobText
      if (mode === 'url') {
        const scrapeRes = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: jobUrl }),
        })
        if (!scrapeRes.ok) throw new Error('Failed to fetch job description from URL')
        const { text } = await scrapeRes.json() as { text: string }
        jobDescription = text
      }

      // 2. Create application
      const createRes = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          jobTitle,
          industry,
          jobUrl: mode === 'url' ? jobUrl : undefined,
          jobDescription,
        }),
      })
      if (!createRes.ok) throw new Error('Failed to create application')
      const app = await createRes.json() as { id: number }

      // 3. Trigger generation
      const genRes = await fetch(`/api/applications/${app.id}/generate`, { method: 'POST' })
      if (!genRes.ok) throw new Error('Failed to generate resume')

      router.push(`/apply/${app.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-6 py-10 space-y-5">
      <h1 className="text-2xl font-semibold">New Application</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
        <input
          type="text"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Stripe"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
        <input
          type="text"
          required
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Staff Software Engineer"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
        <input
          type="text"
          required
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Fintech"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Job Description</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`text-sm px-3 py-1.5 rounded border ${mode === 'text' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}
          >
            Paste Text
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`text-sm px-3 py-1.5 rounded border ${mode === 'url' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}
          >
            Paste URL
          </button>
        </div>
        {mode === 'text' ? (
          <textarea
            required
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={10}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="Paste the full job description here..."
          />
        ) : (
          <input
            type="url"
            required
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://jobs.stripe.com/..."
          />
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white text-sm py-2.5 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Generating resume… this may take 30–60 seconds' : 'Create & Generate Resume'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create `/api/scrape` route for URL mode**

```typescript
// app/api/scrape/route.ts
import { NextResponse } from 'next/server'
import { fetchJobDescription } from '@/lib/scraper'

export async function POST(request: Request) {
  const { url } = await request.json() as { url: string }
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  try {
    const text = await fetchJobDescription(url)
    return NextResponse.json({ text })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch URL' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Create `app/apply/new/page.tsx`**

```typescript
// app/apply/new/page.tsx
import NewApplicationForm from '@/components/NewApplicationForm'

export default function NewApplicationPage() {
  return <NewApplicationForm />
}
```

- [ ] **Step 4: Verify in browser**

Navigate to [http://localhost:3000/apply/new](http://localhost:3000/apply/new). Toggle between URL/Text modes. Fill in form fields and verify they accept input. Do not submit yet (generate API needs a real ANTHROPIC_API_KEY set).

- [ ] **Step 5: Commit**

```bash
git add components/NewApplicationForm.tsx app/apply/new/page.tsx app/api/scrape/route.ts
git commit -m "feat: add new application form with URL/text JD input"
```

---

## Task 16: Workspace UI Components

**Files:**
- Create: `components/ui/ResumeRenderer.tsx`
- Create: `components/ui/VersionSelector.tsx`
- Create: `components/ui/ExportButtons.tsx`

- [ ] **Step 1: Create `components/ui/ResumeRenderer.tsx`**

```typescript
// components/ui/ResumeRenderer.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  content: string
}

export default function ResumeRenderer({ content }: Props) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mt-5 mb-1 border-b border-gray-200 pb-1">{children}</h2>,
          ul: ({ children }) => <ul className="mt-1 mb-3 space-y-0.5">{children}</ul>,
          li: ({ children }) => <li className="text-sm text-gray-800 ml-4 list-disc">{children}</li>,
          p: ({ children }) => <p className="text-sm text-gray-800 mb-2">{children}</p>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/ui/VersionSelector.tsx`**

```typescript
// components/ui/VersionSelector.tsx
'use client'

import type { ResumeVersion } from '@/types'

interface Props {
  versions: ResumeVersion[]
  selectedVersionNumber: number
  onChange: (versionNumber: number) => void
}

export default function VersionSelector({ versions, selectedVersionNumber, onChange }: Props) {
  return (
    <select
      value={selectedVersionNumber}
      onChange={(e) => onChange(Number(e.target.value))}
      className="text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
    >
      {versions.map((v) => (
        <option key={v.id} value={v.versionNumber}>
          Version {v.versionNumber} — {new Date(v.createdAt).toLocaleString()}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 3: Create `components/ui/ExportButtons.tsx`**

```typescript
// components/ui/ExportButtons.tsx
'use client'

interface Props {
  applicationId: number
  versionNumber: number
}

export default function ExportButtons({ applicationId, versionNumber }: Props) {
  const base = `/api/applications/${applicationId}/export`

  return (
    <div className="flex gap-2">
      <a
        href={`${base}/pdf?version=${versionNumber}`}
        download
        className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50"
      >
        Download PDF
      </a>
      <a
        href={`${base}/docx?version=${versionNumber}`}
        download
        className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50"
      >
        Download DOCX
      </a>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/ui/ResumeRenderer.tsx components/ui/VersionSelector.tsx components/ui/ExportButtons.tsx
git commit -m "feat: add ResumeRenderer, VersionSelector, and ExportButtons components"
```

---

## Task 17: ChatPanel Component + Application Workspace Page

**Files:**
- Create: `components/ui/ChatPanel.tsx`
- Create: `app/apply/[id]/page.tsx`

- [ ] **Step 1: Create `components/ui/ChatPanel.tsx`**

```typescript
// components/ui/ChatPanel.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from '@/types'

interface Props {
  messages: ChatMessage[]
  applicationId: number
  onNewVersion: (versionNumber: number, content: string) => void
}

export default function ChatPanel({ messages: initialMessages, applicationId, onNewVersion }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || sending) return
    const userMessage = input.trim()
    setInput('')
    setSending(true)

    const optimisticUser: ChatMessage = {
      id: Date.now(),
      applicationId,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    try {
      const res = await fetch(`/api/applications/${applicationId}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
      })
      const data = await res.json() as {
        version: { versionNumber: number; content: string }
        changeSummary: string
      }

      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        applicationId,
        role: 'assistant',
        content: data.changeSummary || 'Resume updated.',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      onNewVersion(data.version.versionNumber, data.version.content)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">
            Give feedback to iterate on the resume.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm rounded px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-blue-50 text-blue-900 ml-6'
                : 'bg-gray-100 text-gray-800 mr-6'
            }`}
          >
            <p className="text-xs font-medium mb-1 opacity-60">
              {msg.role === 'user' ? 'You' : 'Claude'}
            </p>
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          rows={2}
          placeholder="e.g. Make the summary punchier, cut the internship section…"
          className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-blue-500"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="self-end bg-blue-600 text-white text-sm px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/apply/[id]/page.tsx`**

```typescript
// app/apply/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ResumeRenderer from '@/components/ui/ResumeRenderer'
import VersionSelector from '@/components/ui/VersionSelector'
import ExportButtons from '@/components/ui/ExportButtons'
import ChatPanel from '@/components/ui/ChatPanel'
import type { Application, ResumeVersion, ChatMessage } from '@/types'

export default function ApplicationWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const applicationId = Number(id)

  const [application, setApplication] = useState<Application | null>(null)
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedVersionNumber, setSelectedVersionNumber] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [appRes, versionsRes, messagesRes] = await Promise.all([
        fetch(`/api/applications/${applicationId}`),
        fetch(`/api/applications/${applicationId}/versions`),
        fetch(`/api/applications/${applicationId}/messages`),
      ])
      const [app, vers, msgs] = await Promise.all([
        appRes.json() as Promise<Application>,
        versionsRes.json() as Promise<ResumeVersion[]>,
        messagesRes.json() as Promise<ChatMessage[]>,
      ])
      setApplication(app)
      setVersions(vers)
      setMessages(msgs)
      if (vers.length > 0) {
        setSelectedVersionNumber(vers[vers.length - 1].versionNumber)
      }
      setLoading(false)
    }
    load()
  }, [applicationId])

  function handleNewVersion(versionNumber: number, content: string) {
    const newVersion: ResumeVersion = {
      id: Date.now(),
      applicationId,
      versionNumber,
      content,
      createdAt: new Date().toISOString(),
    }
    setVersions((prev) => [...prev, newVersion])
    setSelectedVersionNumber(versionNumber)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[calc(100vh-56px)] text-gray-400">Loading…</div>
  }

  if (!application) {
    return <div className="p-10 text-red-500">Application not found.</div>
  }

  const selectedVersion = versions.find((v) => v.versionNumber === selectedVersionNumber)

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Left panel */}
      <div className="flex-1 flex flex-col border-r border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
          <div>
            <span className="font-medium text-gray-900">{application.companyName}</span>
            <span className="text-gray-400 mx-2">·</span>
            <span className="text-gray-600 text-sm">{application.jobTitle}</span>
            <span className="ml-2 bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded">{application.industry}</span>
          </div>
          <div className="flex items-center gap-3">
            <VersionSelector
              versions={versions}
              selectedVersionNumber={selectedVersionNumber}
              onChange={setSelectedVersionNumber}
            />
            <ExportButtons applicationId={applicationId} versionNumber={selectedVersionNumber} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          {selectedVersion ? (
            <ResumeRenderer content={selectedVersion.content} />
          ) : (
            <p className="text-gray-400 text-sm">No resume generated yet.</p>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-80 flex flex-col bg-gray-50">
        <div className="px-4 py-3 border-b border-gray-200 text-sm font-medium text-gray-700">
          Iterate
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            applicationId={applicationId}
            onNewVersion={handleNewVersion}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add messages API route**

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add components/ui/ChatPanel.tsx app/apply/[id]/page.tsx app/api/applications/[id]/messages/route.ts
git commit -m "feat: add application workspace page with chat iteration panel"
```

---

## Task 18: End-to-End Smoke Test

- [ ] **Step 1: Set your real credentials in `.env.local`**

Ensure `ANTHROPIC_API_KEY` and `DATABASE_URL` are set with real values.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Add master resume**

Navigate to [http://localhost:3000/master](http://localhost:3000/master). Paste a real resume in markdown format. Click Save.

- [ ] **Step 4: Create a new application**

Navigate to [http://localhost:3000/apply/new](http://localhost:3000/apply/new). Fill in a real company + job title + industry. Paste a real job description. Submit. Wait 30–60s for generation.

- [ ] **Step 5: Verify workspace**

Expect to land on `/apply/[id]` with:
- Tailored resume rendered on the left
- Version 1 selected in the dropdown
- Empty chat panel on the right

- [ ] **Step 6: Test iteration**

Type "Make the summary section more concise" in the chat input. Press Enter. Expect Version 2 to appear in the dropdown with the updated resume.

- [ ] **Step 7: Test export**

Click "Download PDF" and "Download DOCX". Verify both files download and open correctly.

- [ ] **Step 8: Verify dashboard**

Navigate to [http://localhost:3000](http://localhost:3000). Expect the application to appear in the table with version count = 2.

- [ ] **Step 9: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "feat: career agent complete — master resume, generation, iteration, export"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ MasterResume (single row, markdown, manual save) — Tasks 2, 4, 14
- ✅ Application with tags — Tasks 2, 5, 15
- ✅ ResumeVersion (immutable, versioned) — Tasks 2, 9, 10
- ✅ ChatMessage (full history) — Tasks 2, 10, 17
- ✅ JD via URL or paste — Tasks 7, 15
- ✅ Claude Call 1 with web_search — Task 9
- ✅ Claude Call 2 with cached research + history — Task 10
- ✅ `---CHANGES---` delimiter parsing — Tasks 8, 10
- ✅ Gap Analysis section — Task 9 (extractResumePart strips it from stored version)
- ✅ PDF export — Tasks 11, 16
- ✅ DOCX export — Tasks 11, 16
- ✅ Version selector — Tasks 16, 17
- ✅ Dashboard — Task 13
- ✅ Industry best practices in system prompt — Task 8
- ✅ Company research cached on Application — Task 9
- ✅ No auth — no auth code anywhere

**Type consistency check:**
- `CompanyResearch` defined in `types/index.ts`, imported in `lib/claude.ts`, `app/api/applications/[id]/generate/route.ts`, and `app/api/applications/[id]/iterate/route.ts` — consistent
- `ResumeVersion`, `ChatMessage`, `Application` all sourced from `types/index.ts` — consistent
- `parseIterationResponse` returns `{ resumeMarkdown, changeSummary }` — consumed correctly in iterate route
