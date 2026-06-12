import type { IpcMain } from 'electron'
import { GitLabService } from '../services/GitLabService'
import { getGitLabBaseUrl } from '../utils/settings'
import keytar from 'keytar'

const SERVICE = 'codesense'

async function buildService(): Promise<GitLabService> {
  const token = await keytar.getPassword(SERVICE, 'gitlab-token')
  if (!token) throw new Error('GitLab token not configured')
  return new GitLabService(token, getGitLabBaseUrl())
}

export function registerGitLabHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('gitlab:listMRs', async (_e, projectId: string, page: number) => {
    const svc = await buildService()
    return svc.listMRs(projectId, page)
  })

  ipcMain.handle('gitlab:getMRDiff', async (_e, projectId: string, mrIid: number) => {
    const svc = await buildService()
    return svc.getMRDiff(projectId, mrIid)
  })
}
