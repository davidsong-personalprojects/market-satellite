import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePDF, safeFilename } from '@/lib/export'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const numId = Number(id)
  if (!Number.isInteger(numId) || numId < 1) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const versionNumber = Number(searchParams.get('version') ?? '1')
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return NextResponse.json({ error: 'Invalid version' }, { status: 400 })
  }

  const [application, version] = await Promise.all([
    prisma.application.findUnique({ where: { id: numId } }),
    prisma.resumeVersion.findFirst({
      where: { applicationId: numId, versionNumber },
    }),
  ])

  if (!application || !version) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const buffer = await generatePDF(version.content)
    const filename = safeFilename(application.companyName, application.jobTitle, versionNumber, 'pdf')

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
