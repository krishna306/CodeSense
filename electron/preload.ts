import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,

  auth: {
    setGitLabToken: (token: string) => ipcRenderer.invoke('auth:setGitLabToken', token),
    getGitLabToken: () => ipcRenderer.invoke('auth:getGitLabToken'),
    setAnthropicKey: (key: string) => ipcRenderer.invoke('auth:setAnthropicKey', key),
    clearAll: () => ipcRenderer.invoke('auth:clearAll'),
    testGitlab: (url: string, token: string) =>
      ipcRenderer.invoke('auth:testGitlab', url, token),
    testAnthropic: (key: string) => ipcRenderer.invoke('auth:testAnthropic', key),
    setProviderKey: (provider: string, key: string) =>
      ipcRenderer.invoke('auth:setProviderKey', provider, key),
    hasProviderKey: (provider: string) => ipcRenderer.invoke('auth:hasProviderKey', provider),
    testProvider: (provider: string, key: string) =>
      ipcRenderer.invoke('auth:testProvider', provider, key)
  },

  gitlab: {
    listMRs: (projectId: string, page: number) =>
      ipcRenderer.invoke('gitlab:listMRs', projectId, page),
    getMRDiff: (projectId: string, mrIid: number) =>
      ipcRenderer.invoke('gitlab:getMRDiff', projectId, mrIid)
  },

  review: {
    start: (projectId: string, mrIid: number) =>
      ipcRenderer.invoke('review:start', projectId, mrIid),
    cancel: () => ipcRenderer.invoke('review:cancel')
  },

  report: {
    exportMarkdown: (markdown: string, defaultName: string) =>
      ipcRenderer.invoke('report:export', markdown, defaultName),
    exportPdf: (html: string, defaultName: string) =>
      ipcRenderer.invoke('report:exportPdf', html, defaultName)
  },

  storage: {
    getSettings: () => ipcRenderer.invoke('storage:getSettings'),
    saveSettings: (settings: unknown) => ipcRenderer.invoke('storage:saveSettings', settings)
  },

  on: (
    channel: 'review:suggestion' | 'review:complete' | 'review:error',
    cb: (...args: unknown[]) => void
  ) => {
    const wrapper = (_event: unknown, ...args: unknown[]) => cb(...args)
    listenerMap.set(cb, wrapper)
    ipcRenderer.on(channel, wrapper as never)
  },

  off: (
    channel: 'review:suggestion' | 'review:complete' | 'review:error',
    cb: (...args: unknown[]) => void
  ) => {
    const wrapper = listenerMap.get(cb)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper as never)
      listenerMap.delete(cb)
    }
  }
})

const listenerMap = new WeakMap<
  (...args: unknown[]) => void,
  (_event: unknown, ...args: unknown[]) => void
>()
