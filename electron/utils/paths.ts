import { app } from 'electron'
import { join } from 'path'

export const userData = () => app.getPath('userData')
export const dbPath = () => join(userData(), 'codesense.db')
export const logsPath = () => join(userData(), 'logs')
