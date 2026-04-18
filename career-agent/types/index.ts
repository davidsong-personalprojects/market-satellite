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
