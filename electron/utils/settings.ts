import { getDb } from './db'

export function getAppSettings(): Record<string, unknown> {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_settings') as
    | { value: string }
    | undefined
  return row ? JSON.parse(row.value) : {}
}

export function getSelectedProvider(): string {
  const settings = getAppSettings()
  return typeof settings.provider === 'string' && settings.provider
    ? settings.provider
    : 'anthropic'
}

export function getSelectedModel(): string {
  const settings = getAppSettings()
  return typeof settings.model === 'string' && settings.model
    ? settings.model
    : 'claude-sonnet-4-6'
}

export function getGitLabBaseUrl(): string {
  const settings = getAppSettings()
  const url = typeof settings.gitlabUrl === 'string' ? settings.gitlabUrl : ''
  return url ? `${url.replace(/\/$/, '')}/api/v4` : 'https://gitlab.com/api/v4'
}
