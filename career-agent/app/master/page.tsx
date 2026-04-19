import { prisma } from '@/lib/prisma'
import MasterResumeEditor from '@/components/MasterResumeEditor'

export default async function MasterPage() {
  const record = await prisma.masterResume.findUnique({ where: { id: 1 } })
  const content = record?.content ?? ''
  const updatedAt = record?.updatedAt.toISOString() ?? new Date().toISOString()

  return <MasterResumeEditor initialContent={content} updatedAt={updatedAt} />
}
