import React, { useState } from 'react'
import './OnboardingScreen.css'
import { Button } from './primitives/Button'
import { Input } from './primitives/Input'
import { Select } from './primitives/Select'
import { ConnectionStatus } from './ConnectionStatus'
import { useSettingsStore } from '../store/settingsStore'
import { AVAILABLE_PROVIDERS, AVAILABLE_MODELS } from '../../shared/types'
import type { AIProviderId } from '../../shared/types'
import type { ToastMessage } from './primitives/Toast'

type ConnStatus = 'idle' | 'checking' | 'ok' | 'error'
type Step = 'gitlab' | 'anthropic' | 'done'

interface Props {
  onComplete: () => void
  onShowHelp: () => void
  addToast: (t: Omit<ToastMessage, 'id'>) => void
}

export function OnboardingScreen({ onComplete, onShowHelp, addToast }: Props) {
  const [step, setStep] = useState<Step>('gitlab')

  /* GitLab fields */
  const [gitlabUrl, setGitlabUrl] = useState('https://gitlab.com')
  const [gitlabToken, setGitlabToken] = useState('')
  const [gitlabStatus, setGitlabStatus] = useState<ConnStatus>('idle')
  const [gitlabError, setGitlabError] = useState('')

  /* AI provider fields */
  const saveSettings = useSettingsStore((s) => s.save)
  const [provider, setProvider] = useState<AIProviderId>('anthropic')
  const [aiModel, setAiModel] = useState('claude-sonnet-4-6')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [anthropicStatus, setAnthropicStatus] = useState<ConnStatus>('idle')
  const [anthropicError, setAnthropicError] = useState('')

  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider)!
  const providerModels = AVAILABLE_MODELS.filter((m) => m.provider === provider)

  function switchProvider(next: string) {
    setProvider(next as AIProviderId)
    const firstModel = AVAILABLE_MODELS.find((m) => m.provider === next)
    setAiModel(firstModel?.id ?? '')
    setAnthropicKey('')
    setAnthropicStatus('idle')
    setAnthropicError('')
  }

  const [saving, setSaving] = useState(false)

  /* ── GitLab test ─────────────────────────────────── */
  async function testGitlab() {
    if (!gitlabToken.trim()) { setGitlabError('Token is required'); return }
    if (!gitlabUrl.trim())   { setGitlabError('URL is required');   return }

    setGitlabError('')
    setGitlabStatus('checking')
    try {
      await window.api.auth.testGitlab(gitlabUrl, gitlabToken)
      setGitlabStatus('ok')
    } catch {
      setGitlabStatus('error')
      setGitlabError('Could not reach GitLab. Check the URL and token.')
    }
  }

  async function saveGitlab() {
    if (gitlabStatus !== 'ok') { await testGitlab(); return }
    await window.api.auth.setGitLabToken(gitlabToken)
    await window.api.storage.saveSettings(
      await window.api.storage.getSettings().then((s) => ({ ...s, gitlabUrl }))
    )
    setStep('anthropic')
  }

  /* ── AI provider test ────────────────────────────── */
  async function testAnthropic() {
    if (!anthropicKey.trim()) { setAnthropicError('API key is required'); return }

    setAnthropicError('')
    setAnthropicStatus('checking')
    try {
      await window.api.auth.testProvider(provider, anthropicKey.trim())
      setAnthropicStatus('ok')
    } catch {
      setAnthropicStatus('error')
      setAnthropicError('Invalid or unreachable API key.')
    }
  }

  async function saveAll() {
    if (anthropicStatus !== 'ok') { await testAnthropic(); return }
    setSaving(true)
    try {
      await window.api.auth.setProviderKey(provider, anthropicKey.trim())
      await saveSettings({ provider, model: aiModel })
      addToast({ type: 'success', message: 'Setup complete! Welcome to CodeSense.' })
      onComplete()
    } catch {
      addToast({ type: 'error', message: 'Failed to save credentials.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="onboarding">
      {/* ── Brand mark ── */}
      <div className="onboarding__brand">
        <div className="onboarding__logo">
          <CodeSenseLogo />
        </div>
        <h1 className="onboarding__title">CodeSense</h1>
        <p className="onboarding__subtitle">AI-powered GitLab MR code review</p>
      </div>

      {/* ── Card ── */}
      <div className="onboarding__card">
        {/* Progress steps */}
        <div className="onboarding__steps">
          <StepIndicator index={1} label="GitLab"    active={step === 'gitlab'}    done={step !== 'gitlab'} />
          <span className="onboarding__step-line" />
          <StepIndicator index={2} label="AI Model"  active={step === 'anthropic'} done={step === 'done'} />
        </div>

        {/* ── Step 1: GitLab ── */}
        {step === 'gitlab' && (
          <div className="onboarding__step-content">
            <div className="onboarding__step-header">
              <GitLabIcon />
              <div>
                <h2>Connect GitLab</h2>
                <p>Enter your GitLab instance URL and a personal access token with <code>read_api</code> scope.</p>
              </div>
            </div>

            <div className="onboarding__fields">
              <Input
                label="GitLab URL"
                value={gitlabUrl}
                onChange={(e) => { setGitlabUrl(e.target.value); setGitlabStatus('idle') }}
                placeholder="https://gitlab.com"
                hint="Self-hosted? Enter your instance URL."
              />
              <Input
                label="Personal Access Token"
                value={gitlabToken}
                onChange={(e) => { setGitlabToken(e.target.value); setGitlabStatus('idle') }}
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                revealable
                error={gitlabError}
                hint="Settings → Access Tokens → Create with read_api scope"
              />
            </div>

            <div className="onboarding__footer">
              <div className="onboarding__status-row">
                <ConnectionStatus status={gitlabStatus} />
                {gitlabStatus === 'idle' && (
                  <Button variant="ghost" size="sm" onClick={testGitlab}>
                    Test connection
                  </Button>
                )}
              </div>
              <Button
                size="lg"
                onClick={saveGitlab}
                disabled={!gitlabToken.trim() || !gitlabUrl.trim()}
              >
                {gitlabStatus === 'ok' ? 'Continue →' : 'Test & Continue →'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Anthropic ── */}
        {step === 'anthropic' && (
          <div className="onboarding__step-content">
            <div className="onboarding__step-header">
              <ProviderIcon provider={provider} />
              <div>
                <h2>Connect AI Model</h2>
                <p>Pick your AI provider and model, then add its API key. The key is stored securely in your OS keychain — never on disk.</p>
              </div>
            </div>

            <div className="onboarding__fields">
              <Select
                label="Provider"
                value={provider}
                options={AVAILABLE_PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
                onChange={switchProvider}
              />

              <Select
                label="Model"
                value={aiModel}
                options={providerModels.map((m) => ({
                  value: m.id,
                  label: m.name,
                  description: m.description
                }))}
                onChange={setAiModel}
              />

              <Input
                label={`${providerInfo.name} API Key`}
                value={anthropicKey}
                onChange={(e) => { setAnthropicKey(e.target.value); setAnthropicStatus('idle') }}
                placeholder={providerInfo.keyPlaceholder}
                revealable
                error={anthropicError}
                hint={providerInfo.keyHint}
              />
            </div>

            <div className="onboarding__footer">
              <div className="onboarding__status-row">
                <ConnectionStatus status={anthropicStatus} />
                {anthropicStatus === 'idle' && (
                  <Button variant="ghost" size="sm" onClick={testAnthropic}>
                    Verify key
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setStep('gitlab')}>
                  ← Back
                </Button>
              </div>
              <Button
                size="lg"
                onClick={saveAll}
                loading={saving}
                disabled={!anthropicKey.trim()}
              >
                {anthropicStatus === 'ok' ? 'Finish Setup →' : 'Verify & Finish →'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="onboarding__privacy">
        🔒 Credentials are stored in your OS keychain. CodeSense never transmits them.
        {' · '}
        <button className="onboarding__help-link" onClick={onShowHelp}>
          📖 View user guide
        </button>
      </p>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────── */

function StepIndicator({
  index, label, active, done
}: { index: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`step-ind ${active ? 'step-ind--active' : ''} ${done ? 'step-ind--done' : ''}`}>
      <span className="step-ind__circle">
        {done ? '✓' : index}
      </span>
      <span className="step-ind__label">{label}</span>
    </div>
  )
}

function CodeSenseLogo() {
  /* Mirror of resources/icon.svg — the packaged app icon */
  return (
    <svg width="56" height="56" viewBox="0 0 1024 1024" fill="none">
      <defs>
        <linearGradient id="cs-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1c2c4a"/>
          <stop offset="55%" stopColor="#101a30"/>
          <stop offset="100%" stopColor="#0a1020"/>
        </linearGradient>
        <linearGradient id="cs-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#58a6ff"/>
          <stop offset="100%" stopColor="#388bfd"/>
        </linearGradient>
        <linearGradient id="cs-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#56d364"/>
          <stop offset="100%" stopColor="#3fb950"/>
        </linearGradient>
      </defs>
      <rect x="64" y="64" width="896" height="896" rx="200" fill="url(#cs-bg)"/>
      <rect x="64" y="64" width="896" height="896" rx="200" fill="none" stroke="#388bfd" strokeOpacity="0.25" strokeWidth="6"/>
      <path d="M 360 360 L 220 512 L 360 664" fill="none" stroke="url(#cs-accent)" strokeWidth="58" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M 664 360 L 804 512 L 664 664" fill="none" stroke="url(#cs-accent)" strokeWidth="58" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M 430 540 L 502 620 L 622 388" fill="none" stroke="url(#cs-green)" strokeWidth="58" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function GitLabIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" fill="#fc6d26"/>
    </svg>
  )
}

function ProviderIcon({ provider }: { provider: AIProviderId }) {
  switch (provider) {
    case 'anthropic':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#cc785c"/>
          <path d="M8 17l4-10 4 10M9.5 13.5h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    case 'openai':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#10a37f"/>
          <circle cx="12" cy="12" r="5.5" stroke="#fff" strokeWidth="1.5"/>
          <path d="M12 6.5v3M12 14.5v3M6.5 12h3M14.5 12h3M8.2 8.2l2.1 2.1M13.7 13.7l2.1 2.1M15.8 8.2l-2.1 2.1M10.3 13.7l-2.1 2.1"
                stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )
    case 'xai':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#111111"/>
          <path d="M7 7l10 10M17 7L7 17" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )
    case 'gemini':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#1a73e8"/>
          <path d="M12 5c.4 3.9 3.1 6.6 7 7-3.9.4-6.6 3.1-7 7-.4-3.9-3.1-6.6-7-7 3.9-.4 6.6-3.1 7-7z" fill="#fff"/>
        </svg>
      )
  }
}
