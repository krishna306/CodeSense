import React, { useState } from 'react'
import './SettingsScreen.css'
import { Button } from '../primitives/Button'
import { Input } from '../primitives/Input'
import { Select } from '../primitives/Select'
import { AVAILABLE_MODELS, AVAILABLE_PROVIDERS } from '../../../shared/types'
import type { AIProviderId } from '../../../shared/types'
import { ConnectionStatus } from '../ConnectionStatus'
import { useSettingsStore } from '../../store/settingsStore'
import type { ToastMessage } from '../primitives/Toast'

type ConnStatus = 'idle' | 'checking' | 'ok' | 'error'

interface Props {
  onClose: () => void
  onCredentialsCleared: () => void
  onShowHelp: () => void
  addToast: (t: Omit<ToastMessage, 'id'>) => void
}

export function SettingsScreen({ onClose, onCredentialsCleared, onShowHelp, addToast }: Props) {
  const settings = useSettingsStore()

  /* ── GitLab section state ── */
  const [gitlabUrl, setGitlabUrl] = useState(settings.gitlabUrl)
  const [gitlabToken, setGitlabToken] = useState('')          // blank = unchanged
  const [gitlabStatus, setGitlabStatus] = useState<ConnStatus>('idle')
  const [savingGitlab, setSavingGitlab] = useState(false)

  /* ── AI provider section state ── */
  const provider = (settings.provider || 'anthropic') as AIProviderId
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider)!
  const providerModels = AVAILABLE_MODELS.filter((m) => m.provider === provider)
  const [aiKey, setAiKey] = useState('')                      // blank = unchanged
  const [aiKeySaved, setAiKeySaved] = useState<boolean | null>(null)
  const [aiStatus, setAiStatus] = useState<ConnStatus>('idle')
  const [savingKey, setSavingKey] = useState(false)

  /* check whether a key exists for the selected provider */
  React.useEffect(() => {
    setAiKeySaved(null)
    window.api.auth.hasProviderKey(provider).then(setAiKeySaved)
  }, [provider])

  function switchProvider(next: string) {
    const firstModel = AVAILABLE_MODELS.find((m) => m.provider === next)
    settings.save({ provider: next, model: firstModel?.id ?? '' })
    setAiKey('')
    setAiStatus('idle')
  }

  /* ── Danger zone ── */
  const [confirmingClear, setConfirmingClear] = useState(false)

  async function testGitlab(): Promise<boolean> {
    setGitlabStatus('checking')
    try {
      const token = gitlabToken.trim() || (await window.api.auth.getGitLabToken()) || ''
      await window.api.auth.testGitlab(gitlabUrl, token)
      setGitlabStatus('ok')
      return true
    } catch {
      setGitlabStatus('error')
      return false
    }
  }

  async function saveGitlab() {
    setSavingGitlab(true)
    try {
      const ok = await testGitlab()
      if (!ok) {
        addToast({ type: 'error', message: 'GitLab connection failed — not saved.' })
        return
      }
      if (gitlabToken.trim()) {
        await window.api.auth.setGitLabToken(gitlabToken.trim())
      }
      await settings.save({ gitlabUrl: gitlabUrl.trim().replace(/\/$/, '') })
      setGitlabToken('')
      addToast({ type: 'success', message: 'GitLab settings saved.' })
    } finally {
      setSavingGitlab(false)
    }
  }

  async function testAiKey(): Promise<boolean> {
    setAiStatus('checking')
    try {
      await window.api.auth.testProvider(provider, aiKey.trim())
      setAiStatus('ok')
      return true
    } catch {
      setAiStatus('error')
      return false
    }
  }

  async function saveAiKey() {
    if (!aiKey.trim()) return
    setSavingKey(true)
    try {
      const ok = await testAiKey()
      if (!ok) {
        addToast({ type: 'error', message: 'API key verification failed — not saved.' })
        return
      }
      await window.api.auth.setProviderKey(provider, aiKey.trim())
      setAiKey('')
      setAiKeySaved(true)
      addToast({ type: 'success', message: `${providerInfo.name} API key updated.` })
    } finally {
      setSavingKey(false)
    }
  }

  async function clearAll() {
    await window.api.auth.clearAll()
    addToast({ type: 'info', message: 'All credentials removed.' })
    onCredentialsCleared()
  }

  return (
    <div className="settings">
      <header className="settings__header">
        <h1>Settings</h1>
        <Button variant="ghost" size="sm" onClick={onClose}>✕ Close</Button>
      </header>

      <div className="settings__scroll">
        {/* ── GitLab ─────────────────────────────── */}
        <section className="settings__section">
          <div className="settings__section-head">
            <h2>GitLab</h2>
            <ConnectionStatus status={gitlabStatus} />
          </div>

          <Input
            label="GitLab URL"
            value={gitlabUrl}
            onChange={(e) => { setGitlabUrl(e.target.value); setGitlabStatus('idle') }}
            placeholder="https://gitlab.example.com"
          />
          <Input
            label="Personal Access Token"
            value={gitlabToken}
            onChange={(e) => { setGitlabToken(e.target.value); setGitlabStatus('idle') }}
            placeholder="•••••••• (leave blank to keep current token)"
            revealable
            hint="Stored in OS keychain. Only filled values overwrite the saved token."
          />

          <div className="settings__actions">
            <Button variant="secondary" size="sm" onClick={testGitlab}>Test connection</Button>
            <Button size="sm" onClick={saveGitlab} loading={savingGitlab}>Save GitLab settings</Button>
          </div>
        </section>

        {/* ── AI Provider & Model ────────────────── */}
        <section className="settings__section">
          <div className="settings__section-head">
            <h2>AI Model</h2>
            <ConnectionStatus status={aiStatus} />
          </div>

          <Select
            label="Provider"
            value={provider}
            options={AVAILABLE_PROVIDERS.map((p) => ({
              value: p.id,
              label: p.name
            }))}
            onChange={switchProvider}
            hint={
              aiKeySaved === false
                ? '⚠ No API key saved for this provider yet — add one below.'
                : aiKeySaved === true
                  ? '✓ API key saved for this provider.'
                  : undefined
            }
          />

          <Select
            label="Model"
            value={settings.model}
            options={providerModels.map((m) => ({
              value: m.id,
              label: m.name,
              description: m.description
            }))}
            onChange={(model) => {
              settings.save({ model })
              addToast({ type: 'success', message: `Model switched to ${model}` })
            }}
            hint="Applies to the next review you run."
          />

          <Input
            label={`${providerInfo.name} API Key`}
            value={aiKey}
            onChange={(e) => { setAiKey(e.target.value); setAiStatus('idle') }}
            placeholder={
              aiKeySaved
                ? '•••••••• (leave blank to keep current key)'
                : providerInfo.keyPlaceholder
            }
            revealable
            hint={providerInfo.keyHint}
          />

          <div className="settings__actions">
            <Button
              variant="secondary" size="sm"
              onClick={testAiKey}
              disabled={!aiKey.trim() && !aiKeySaved}
            >
              Verify key
            </Button>
            <Button size="sm" onClick={saveAiKey} loading={savingKey} disabled={!aiKey.trim()}>
              Save API key
            </Button>
          </div>
        </section>

        {/* ── Appearance ─────────────────────────── */}
        <section className="settings__section">
          <div className="settings__section-head">
            <h2>Appearance</h2>
          </div>
          <Select
            label="Theme"
            value={settings.theme || 'system'}
            options={[
              { value: 'system', label: 'System', description: 'Follow your macOS appearance setting' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' }
            ]}
            onChange={(theme) => settings.save({ theme: theme as 'system' | 'light' | 'dark' })}
          />
        </section>

        {/* ── Help ───────────────────────────────── */}
        <section className="settings__section">
          <div className="settings__section-head">
            <h2>Help</h2>
          </div>
          <p className="settings__danger-text">
            Full documentation of every feature — setup, reviewing MRs, exports, providers,
            troubleshooting, and cost guidance.
          </p>
          <div className="settings__actions">
            <Button variant="secondary" size="sm" onClick={onShowHelp}>
              📖 Open user guide
            </Button>
          </div>
        </section>

        {/* ── Danger zone ────────────────────────── */}
        <section className="settings__section settings__section--danger">
          <div className="settings__section-head">
            <h2>Danger Zone</h2>
          </div>
          <p className="settings__danger-text">
            Removes the GitLab token and Anthropic API key from your OS keychain.
            You will be returned to the setup screen.
          </p>
          {confirmingClear ? (
            <div className="settings__actions">
              <Button variant="danger" size="sm" onClick={clearAll}>Yes, remove credentials</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingClear(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="settings__actions">
              <Button variant="danger" size="sm" onClick={() => setConfirmingClear(true)}>
                Clear all credentials…
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
