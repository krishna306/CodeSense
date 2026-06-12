import { app, BrowserWindow, ipcMain, nativeImage, Menu } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerAuthHandlers } from './ipc/auth.ipc'
import { registerGitLabHandlers } from './ipc/gitlab.ipc'
import { registerReviewHandlers } from './ipc/review.ipc'
import { registerStorageHandlers } from './ipc/storage.ipc'
import { registerReportHandlers } from './ipc/report.ipc'
import { getPlatformTitleBar } from './platform/platform'

app.setName('CodeSense')

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [{
          label: 'CodeSense',
          submenu: [
            { role: 'about' as const, label: 'About CodeSense' },
            { type: 'separator' as const },
            { role: 'hide' as const, label: 'Hide CodeSense' },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const, label: 'Quit CodeSense' }
          ]
        }]
      : []),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function resolveIcon(): string | undefined {
  // packaged builds get the icon from electron-builder; this covers dev mode
  const png = join(app.getAppPath(), 'resources', 'icon.png')
  return existsSync(png) ? png : undefined
}

function createWindow(): BrowserWindow {
  const titleBarOpts = getPlatformTitleBar()
  const icon = resolveIcon()

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1066,
    minHeight: 800,
    frame: false,
    ...(icon && process.platform !== 'darwin' ? { icon } : {}),
    ...titleBarOpts,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  buildAppMenu()
  if (process.platform === 'darwin') {
    const icon = resolveIcon()
    if (icon) app.dock.setIcon(nativeImage.createFromPath(icon))
  }

  registerAuthHandlers(ipcMain)
  registerGitLabHandlers(ipcMain)
  registerReviewHandlers(ipcMain)
  registerStorageHandlers(ipcMain)
  registerReportHandlers(ipcMain)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
