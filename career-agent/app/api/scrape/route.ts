import { NextResponse } from 'next/server'
import { fetchJobDescription } from '@/lib/scraper'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const { url } = body as { url: unknown }
  if (typeof url !== 'string' || !url.trim()) {
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
