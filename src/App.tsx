import React, { useEffect, useState, useCallback } from 'react'
import { TitleBar } from './components/TitleBar'
import { OnboardingScreen } from './components/OnboardingScreen'
import { AppLayout } from './components/layout/AppLayout'
import { Sidebar } from './components/layout/Sidebar'
import { ReviewPanel } from './components/review/ReviewPanel'
import { SettingsScreen } from './components/settings/SettingsScreen'
import { HelpScreen } from './components/HelpScreen'
import { ToastContainer } from './components/primitives/Toast'
import { Spinner } from './components/primitives/Spinner'
import { useSettingsStore } from './store/settingsStore'
import { useTheme } from './hooks/useTheme'
import type { ToastMessage } from './components/primitives/Toast'
import './styles/global.css'
import './styles/platform.css'
import './styles/markdown.css'
import './App.css'

type AppState = 'loading' | 'onboarding' | 'main' | 'settings'

export default function App() {
  const { load } = useSettingsStore()
  useTheme()
  const [appState, setAppState] = useState<AppState>('loading')
  const [showHelp, setShowHelp] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    async function init() {
      await load()
      const token = await window.api.auth.getGitLabToken()
      setAppState(token ? 'main' : 'onboarding')
    }
    init()
  }, [])

  const addToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    setToasts((prev) => [...prev, { ...t, id: crypto.randomUUID() }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <div className="app">
      <TitleBar />

      <div className="app__body">
        {appState === 'loading' && (
          <div className="app__loading">
            <Spinner size={28} />
          </div>
        )}

        {appState === 'onboarding' && (
          <OnboardingScreen
            onComplete={() => setAppState('main')}
            onShowHelp={() => setShowHelp(true)}
            addToast={addToast}
          />
        )}

        {appState === 'main' && (
          <AppLayout sidebar={<Sidebar onOpenSettings={() => setAppState('settings')} />}>
            <ReviewPanel />
          </AppLayout>
        )}

        {appState === 'settings' && (
          <SettingsScreen
            onClose={() => setAppState('main')}
            onCredentialsCleared={() => setAppState('onboarding')}
            onShowHelp={() => setShowHelp(true)}
            addToast={addToast}
          />
        )}
      </div>

      {showHelp && <HelpScreen onClose={() => setShowHelp(false)} />}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
