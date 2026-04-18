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
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; career-agent/1.0)' },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
    }
    const html = await response.text()
    return extractText(html)
  } finally {
    clearTimeout(timer)
  }
}
