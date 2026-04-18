// @vitest-environment node
// lib/claude.test.ts
import { describe, it, expect } from 'vitest'
import { buildGenerateMessage, buildIterateContext, parseIterationResponse, extractResumePart } from './claude'

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

describe('extractResumePart', () => {
  it('strips ## Gap Analysis and everything after it', () => {
    const full = '# Resume\n\n## Experience\n- Bullet\n\n## Gap Analysis\n- Missing skill'
    expect(extractResumePart(full)).toBe('# Resume\n\n## Experience\n- Bullet')
  })

  it('returns full response when no ## Gap Analysis present', () => {
    const full = '# Resume\n\n## Experience\n- Bullet'
    expect(extractResumePart(full)).toBe('# Resume\n\n## Experience\n- Bullet')
  })
})
