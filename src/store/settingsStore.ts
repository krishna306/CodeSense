import { create } from 'zustand'
import type { AppSettings } from '../types/ipc'

interface SettingsState extends AppSettings {
  loaded: boolean
  load: () => Promise<void>
  save: (patch: Partial<AppSettings>) => Promise<void>
}

const DEFAULTS: AppSettings = {
  gitlabUrl: 'https://gitlab.com',
  projectId: '',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  severityThreshold: 'warning',
  theme: 'system',
  recentProjects: []
}

function toPlainSettings(state: SettingsState): AppSettings {
  return {
    gitlabUrl: state.gitlabUrl,
    projectId: state.projectId,
    provider: state.provider,
    model: state.model,
    severityThreshold: state.severityThreshold,
    theme: state.theme,
    recentProjects: state.recentProjects
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    const saved = await window.api.storage.getSettings()
    set({ ...DEFAULTS, ...saved, loaded: true })
  },
  save: async (patch) => {
    set(patch)
    const plain = { ...toPlainSettings(get()), ...patch }
    await window.api.storage.saveSettings(plain)
  }
}))
