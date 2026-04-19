import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { Page, Text, View, Document as PDFDocument, StyleSheet } from '@react-pdf/renderer'

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
