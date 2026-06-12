import type { BrowserWindowConstructorOptions } from 'electron'

export function getPlatformTitleBar(): Partial<BrowserWindowConstructorOptions> {
  if (process.platform === 'darwin') {
    return { titleBarStyle: 'hiddenInset' }
  }
  return { titleBarStyle: 'hidden' }
}
