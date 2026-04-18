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
    expect(result).not.toContain('Home | About')    // nav stripped
    expect(result).not.toContain('Copyright 2026')  // footer stripped
  })

  it('returns empty string for empty HTML', () => {
    expect(extractText('')).toBe('')
  })
})
