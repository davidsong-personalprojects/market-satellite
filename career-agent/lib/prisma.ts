import { PrismaClient } from '@prisma/client'
import { PrismaNeonHttp } from '@prisma/adapter-neon'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  // PrismaNeonHttp uses Neon's HTTP transport — correct for serverless/edge environments.
  // Prisma 7 requires adapter to be passed to PrismaClient constructor directly.
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const adapter = new PrismaNeonHttp(url)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
