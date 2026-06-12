import type { MRSummary, Suggestion, ReviewResult, FileDiff } from '../../shared/types'

export interface WindowApi {
  platform: NodeJS.Platform

  auth: {
    setGitLabToken(token: string): Promise<void>
    getGitLabToken(): Promise<string | null>
    setAnthropicKey(key: string): Promise<void>
    clearAll(): Promise<void>
    testGitlab(url: string, token: string): Promise<{ username: string }>
    testAnthropic(key: string): Promise<{ ok: boolean }>
    setProviderKey(provider: string, key: string): Promise<void>
    hasProviderKey(provider: string): Promise<boolean>
    testProvider(provider: string, key: string): Promise<{ ok: boolean }>
  }

  gitlab: {
    listMRs(projectId: string, page: number): Promise<MRSummary[]>
    getMRDiff(projectId: string, mrIid: number): Promise<FileDiff[]>
  }

  review: {
    start(projectId: string, mrIid: number): Promise<void>
    cancel(): Promise<void>
  }

  report: {
    exportMarkdown(markdown: string, defaultName: string): Promise<string | null>
    exportPdf(html: string, defaultName: string): Promise<string | null>
  }

  storage: {
    getSettings(): Promise<AppSettings>
    saveSettings(settings: AppSettings): Promise<void>
  }

  on(channel: 'review:suggestion', cb: (suggestion: Suggestion) => void): void
  on(channel: 'review:complete', cb: (result: ReviewResult) => void): void
  on(channel: 'review:error', cb: (err: { message: string }) => void): void

  off(channel: 'review:suggestion', cb: (suggestion: Suggestion) => void): void
  off(channel: 'review:complete', cb: (result: ReviewResult) => void): void
  off(channel: 'review:error', cb: (err: { message: string }) => void): void
}

export interface AppSettings {
  gitlabUrl: string
  projectId: string
  provider: string
  model: string
  severityThreshold: 'info' | 'warning' | 'error' | 'critical'
  theme: 'system' | 'light' | 'dark'
  recentProjects: string[]
}

declare global {
  interface Window {
    api: WindowApi
  }
}
