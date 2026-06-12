export type ReviewStatus = 'idle' | 'fetching' | 'analyzing' | 'complete' | 'error'

export type AIProviderId = 'anthropic' | 'openai' | 'xai' | 'gemini'

export interface ProviderOption {
  id: AIProviderId
  name: string
  keyPlaceholder: string
  keyHint: string
}

export interface ModelOption {
  id: string
  provider: AIProviderId
  name: string
  description: string
}

export const AVAILABLE_PROVIDERS: ProviderOption[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    keyPlaceholder: 'sk-ant-api03-…',
    keyHint: 'console.anthropic.com → API Keys'
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    keyPlaceholder: 'sk-…',
    keyHint: 'platform.openai.com → API Keys'
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    keyPlaceholder: 'xai-…',
    keyHint: 'console.x.ai → API Keys'
  },
  {
    id: 'gemini',
    name: 'Google (Gemini)',
    keyPlaceholder: 'AIza…',
    keyHint: 'aistudio.google.com → Get API key'
  }
]

export const AVAILABLE_MODELS: ModelOption[] = [
  /* ── Anthropic ── */
  {
    id: 'claude-fable-5',
    provider: 'anthropic',
    name: 'Fable 5',
    description: 'Most capable — deepest reasoning, highest cost'
  },
  {
    id: 'claude-opus-4-8',
    provider: 'anthropic',
    name: 'Opus 4.8',
    description: 'Very capable — thorough reviews of complex changes'
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    name: 'Sonnet 4.6',
    description: 'Recommended — fast, accurate, cost-efficient'
  },
  {
    id: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    name: 'Haiku 4.5',
    description: 'Cheapest Claude — quick checks, ~⅓ the price of Sonnet'
  },
  /* ── OpenAI ── */
  {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    description: 'OpenAI flagship — strong general code review'
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    name: 'GPT-4o mini',
    description: 'Cheap and fast — lighter reviews'
  },
  /* ── xAI ── */
  {
    id: 'grok-3',
    provider: 'xai',
    name: 'Grok 3',
    description: 'xAI flagship model'
  },
  {
    id: 'grok-3-mini',
    provider: 'xai',
    name: 'Grok 3 mini',
    description: 'Smaller, cheaper Grok'
  },
  /* ── Google ── */
  {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    name: 'Gemini 2.5 Pro',
    description: 'Google flagship — strong reasoning, large context'
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    name: 'Gemini 2.5 Flash',
    description: 'Fast and cheap — has a generous free tier'
  }
]

export const DEFAULT_PROVIDER: AIProviderId = 'anthropic'
export const DEFAULT_MODEL = 'claude-sonnet-4-6'

export type SeverityLevel = 'info' | 'warning' | 'error' | 'critical'

export interface Suggestion {
  id: string
  filePath: string
  line: number
  endLine?: number
  severity: SeverityLevel
  title: string
  body: string
  source: 'ai' | 'static'
  score: number
}

export interface MRSummary {
  id: number
  iid: number
  title: string
  description: string
  author: string
  sourceBranch: string
  targetBranch: string
  webUrl: string
  createdAt: string
  updatedAt: string
  changedFiles: number
}

export interface FileDiff {
  oldPath: string
  newPath: string
  diff: string
  isNew: boolean
  isDeleted: boolean
  isRenamed: boolean
}

export interface ReviewResult {
  mrId: number
  suggestions: Suggestion[]
  riskScore: number
  status: ReviewStatus
  rawResponse?: string
  completedAt?: string
}
