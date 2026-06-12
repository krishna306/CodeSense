import type { IpcMain } from 'electron'
import { dialog, BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'

export function registerReportHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('report:export', async (event, markdown: string, defaultName: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Export review report',
      defaultPath: defaultName,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (canceled || !filePath) return null
    await writeFile(filePath, markdown, 'utf-8')
    return filePath
  })

  ipcMain.handle('report:exportPdf', async (event, html: string, defaultName: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Export review report as PDF',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null

    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true }
    })

    try {
      await printWin.loadURL(
        'data:text/html;charset=utf-8,' + encodeURIComponent(html)
      )
      const pdf = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0.6, bottom: 0.6, left: 0.5, right: 0.5 }
      })
      await writeFile(filePath, pdf)
      return filePath
    } finally {
      printWin.destroy()
    }
  })
}
