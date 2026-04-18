# Career Agent — Design Spec
**Date:** 2026-04-17
**Status:** Approved

---

## Overview

A single-user web application that maintains an evergreen master resume and uses Claude to generate tailored, strategically crafted resumes for each job application. Each tailored resume is versioned, tagged, and iterable via free-text chat. Output is rendered on-screen and exportable as PDF and DOCX.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, Tailwind CSS |
| Database | Neon Postgres via Prisma ORM |
| AI | Claude API (`claude-sonnet-4-6`) with `web_search` tool |
| PDF export | `react-pdf` |
| DOCX export | `docx.js` |
| Package manager | npm |

Standalone project — independent from the company screener. No shared DB or codebase.

---

## Data Model

### `MasterResume`
Single row. The user's evergreen, exhaustive resume in markdown format.

| Field | Type | Notes |
|---|---|---|
| `id` | Int PK | Always 1 (single user) |
| `content` | Text | Full resume in markdown, structured with `## Section` headers |
| `updated_at` | DateTime | Updated on each save |

### `Application`
One record per job application.

| Field | Type | Notes |
|---|---|---|
| `id` | Int PK | |
| `company_name` | String | |
| `job_title` | String | |
| `industry` | String | Free-text tag (e.g., "fintech", "B2B SaaS") |
| `job_url` | String? | Optional — if user provided a URL |
| `job_description` | Text | Final resolved JD text (fetched or pasted) |
| `company_research` | Json? | Cached research output from Claude's web_search calls |
| `created_at` | DateTime | |

### `ResumeVersion`
Immutable snapshot per iteration. Never mutated after creation.

| Field | Type | Notes |
|---|---|---|
| `id` | Int PK | |
| `application_id` | Int FK | → Application |
| `version_number` | Int | 1-indexed, increments per application |
| `content` | Text | Tailored resume in markdown |
| `created_at` | DateTime | |

### `ChatMessage`
Full conversation history per application for iteration context.

| Field | Type | Notes |
|---|---|---|
| `id` | Int PK | |
| `application_id` | Int FK | → Application |
| `role` | Enum | `user` or `assistant` |
| `content` | Text | Message text (assistant messages include change summary) |
| `created_at` | DateTime | |

---

## Routes & Pages

### `GET /`
Application dashboard. Table of all applications sorted by `created_at` DESC.

Columns: company name, job title, industry tag, version count, created date.

CTA: "New Application" button → navigates to `/apply/new`.

### `GET /master`
Master resume editor. Full-height markdown textarea pre-populated with the current `MasterResume.content`. Manual Save button — no auto-save. Shows `last updated` timestamp. On save, updates the single `MasterResume` row.

### `GET /apply/new`
New application form.

Fields:
- Company name (text input)
- Job title (text input)
- Industry (text input, free-form tag)
- Job input toggle: **Paste URL** | **Paste Text**
  - URL mode: single URL field; server fetches and extracts JD text on submit
  - Text mode: large textarea for raw JD paste

On submit:
1. Create `Application` record
2. Trigger initial generation (see AI — Call 1)
3. Redirect to `/apply/[id]`

### `GET /apply/[id]`
Main workspace. Two-panel layout:

**Left panel (2/3 width):**
- Version selector dropdown at top (`Version 1`, `Version 2`, …)
- Rendered resume (markdown → clean HTML)
- Export buttons: `Download PDF`, `Download DOCX` (always export selected version)

**Right panel (1/3 width):**
- Chat history (scrollable)
- Text input at bottom for feedback
- On submit: trigger iteration (see AI — Call 2), auto-select new version in left panel

---

## AI — Call 1: Initial Generation

**Trigger:** On `/apply/new` form submit.

**Model:** `claude-sonnet-4-6`

**Tools:** `web_search`

**System prompt (intent):**
> You are an expert resume strategist with deep knowledge of hiring practices across industries. You write resumes that pass ATS filters and impress human reviewers. Every bullet you write is intentional: the right count per role (typically 3–5, fewer for older or less relevant positions), each bullet earning its place by serving a clear strategic purpose — quantified achievement, skill signal, or leadership evidence — written in XYZ format ("Accomplished X by doing Y, resulting in Z"). The bullets across each role form a coherent narrative that speaks directly to the target position. You never pad, never generalize, and you flag gaps honestly.

**User message structure:**
```
Company: {company_name}
Role: {job_title}

Job Description:
{job_description}

Master Resume:
{master_resume_content}

Instructions:
1. Use web_search to research {company_name}: mission, culture, tech stack, team structure, recent news. Cache this context — it will be used in future iterations.
2. Select and rewrite experience, skills, and achievements from the master resume that are most relevant to this role and company.
3. Apply industry best practices: strategic bullet count per role, XYZ format, ATS-optimized language that mirrors the JD's keywords.
4. Flag any gaps: skills or experiences the JD requires that are absent from the master resume. List these at the end under "## Gap Analysis".
5. Output the tailored resume in clean markdown using standard section headers.
```

**Output handling:**
- Extract the resume markdown (everything above `## Gap Analysis`) → store as `ResumeVersion` (version 1)
- Extract company research from tool call results → store as `Application.company_research` JSON
- Store the full assistant response as a `ChatMessage` (role: assistant)

---

## AI — Call 2: Iteration

**Trigger:** User submits a chat message on `/apply/[id]`.

**Model:** `claude-sonnet-4-6`

**Tools:** None (company research already cached)

**Message structure sent to Claude:**
- System prompt: same as Call 1
- Prior `ChatMessage` records for this application (full history)
- New user message

**Context injected as system context:**
```
Current Resume (Version {n}):
{current_version_content}

Original Job Description:
{job_description}

Company Research:
{company_research_json}
```

**Output format:** Claude is instructed to always respond with the resume markdown first, followed by the delimiter `---CHANGES---`, followed by a plain-text bullet list of what changed.

**Output handling:**
- Split response on `---CHANGES---` → resume markdown (before) + change summary (after)
- Store resume markdown → new `ResumeVersion` (version n+1)
- Store user message + assistant response → new `ChatMessage` records
- Left panel auto-selects the new version

---

## Export

### PDF
`react-pdf` renders the tailored resume markdown into a styled PDF using a fixed, ATS-friendly template:
- Single column layout
- Standard fonts (no custom typefaces)
- No tables, graphics, or columns that confuse ATS parsers
- Exported filename: `{company_name}_{job_title}_v{version_number}.pdf`

### DOCX
`docx.js` converts the markdown to a Word document with matching structure.
- Exported filename: `{company_name}_{job_title}_v{version_number}.docx`

Both exports always export the currently selected version in the left panel.

---

## File & Folder Structure

```
/app
  /page.tsx                        # Dashboard — application list
  /master/page.tsx                 # Master resume editor
  /apply
    /new/page.tsx                  # New application form
    /[id]/page.tsx                 # Application workspace
  /api
    /master/route.ts               # GET + PUT master resume
    /applications/route.ts         # GET list + POST new application
    /applications/[id]/route.ts    # GET single application
    /applications/[id]/generate/route.ts   # POST initial generation
    /applications/[id]/iterate/route.ts    # POST iteration
    /applications/[id]/versions/route.ts   # GET version list
    /applications/[id]/export/pdf/route.ts
    /applications/[id]/export/docx/route.ts
/components
  /ui
    /VersionSelector.tsx
    /ChatPanel.tsx
    /ResumeRenderer.tsx
    /ExportButtons.tsx
  /ApplicationTable.tsx
  /MasterResumeEditor.tsx
  /NewApplicationForm.tsx
/lib
  /claude.ts                       # Claude API client + prompt builders
  /scraper.ts                      # JD URL fetching + text extraction
  /export.ts                       # PDF + DOCX generation helpers
  /prisma.ts                       # Prisma singleton
/prisma
  /schema.prisma
/types
  /index.ts
```

---

## Key Constraints

- **No auth.** Single user, no login required.
- **No auto-save** on master resume. Deliberate save only.
- **Versions are immutable.** Iteration always creates a new version, never overwrites.
- **Company research is cached.** Never re-fetched during iteration — only on initial generation.
- **Resume template is fixed.** No user-customizable styling at this stage.
- **One page default.** Claude defaults to one-page resumes unless the role clearly warrants more (e.g., senior technical roles with publications).
