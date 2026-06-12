import type { IpcMain } from 'electron'
import keytar from 'keytar'

const SERVICE = 'codesense'

export function registerAuthHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('auth:setGitLabToken', (_e, token: string) =>
    keytar.setPassword(SERVICE, 'gitlab-token', token)
  )

  ipcMain.handle('auth:getGitLabToken', () =>
    keytar.getPassword(SERVICE, 'gitlab-token')
  )

  ipcMain.handle('auth:setAnthropicKey', (_e, key: string) =>
    keytar.setPassword(SERVICE, 'anthropic-key', key)
  )

  ipcMain.handle('auth:clearAll', async () => {
    await keytar.deletePassword(SERVICE, 'gitlab-token')
    await keytar.deletePassword(SERVICE, 'anthropic-key')
  })

  ipcMain.handle('auth:testGitlab', async (_e, url: string, token: string) => {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/v4/user`, {
      headers: { 'PRIVATE-TOKEN': token }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const user = await res.json() as { username: string }
    return { username: user.username }
  })

  ipcMain.handle('auth:testAnthropic', async (_e, key: string) => {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { ok: true }
  })

  /* ── Multi-provider key management ───────────────────── */

  ipcMain.handle('auth:setProviderKey', (_e, provider: string, key: string) =>
    keytar.setPassword(SERVICE, keyAccount(provider), key)
  )

  ipcMain.handle('auth:hasProviderKey', async (_e, provider: string) => {
    const key = await keytar.getPassword(SERVICE, keyAccount(provider))
    return !!key
  })

  ipcMain.handle('auth:testProvider', async (_e, provider: string, key: string) => {
    const resolved = key || (await keytar.getPassword(SERVICE, keyAccount(provider))) || ''
    if (!resolved) throw new Error('No API key provided or saved')

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': resolved, 'anthropic-version': '2023-06-01' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } else {
      const bases: Record<string, string> = {
        openai: 'https://api.openai.com/v1',
        xai: 'https://api.x.ai/v1',
        gemini: 'https://generativelanguage.googleapis.com/v1beta/openai'
      }
      const base = bases[provider]
      if (!base) throw new Error(`Unknown provider: ${provider}`)
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${resolved}` }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }
    return { ok: true }
  })
}

export function keyAccount(provider: string): string {
  // 'anthropic-key' kept for backwards compatibility with earlier versions
  return provider === 'anthropic' ? 'anthropic-key' : `${provider}-key`
}
