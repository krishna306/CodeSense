import type { IpcMain } from 'electron'
import { getDb } from '../utils/db'

export function registerStorageHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('storage:getSettings', () => {
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_settings') as
      | { value: string }
      | undefined
    return row ? JSON.parse(row.value) : {}
  })

  ipcMain.handle('storage:saveSettings', (_e, settings: unknown) => {
    const db = getDb()
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'app_settings',
      JSON.stringify(settings)
    )
  })
}
