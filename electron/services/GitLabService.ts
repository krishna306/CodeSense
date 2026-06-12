import type { MRSummary, FileDiff } from '../../shared/types'

export class GitLabService {
  private baseUrl: string
  private token: string

  constructor(token: string, baseUrl = 'https://gitlab.com/api/v4') {
    this.token = token
    this.baseUrl = baseUrl
  }

  private async fetch<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'PRIVATE-TOKEN': this.token }
    })
    if (!res.ok) throw new Error(`GitLab API error ${res.status}: ${await res.text()}`)
    return res.json() as Promise<T>
  }

  async listMRs(projectId: string, page = 1): Promise<MRSummary[]> {
    const encoded = encodeURIComponent(projectId)
    const raw = await this.fetch<Record<string, unknown>[]>(
      `/projects/${encoded}/merge_requests?state=opened&per_page=25&page=${page}`
    )
    return raw.map((mr) => ({
      id: mr['id'] as number,
      iid: mr['iid'] as number,
      title: mr['title'] as string,
      description: mr['description'] as string,
      author: (mr['author'] as { username: string }).username,
      sourceBranch: mr['source_branch'] as string,
      targetBranch: mr['target_branch'] as string,
      webUrl: mr['web_url'] as string,
      createdAt: mr['created_at'] as string,
      updatedAt: mr['updated_at'] as string,
      changedFiles: (mr['changes_count'] as number) ?? 0
    }))
  }

  async getMRDiff(projectId: string, mrIid: number): Promise<FileDiff[]> {
    const encoded = encodeURIComponent(projectId)
    const raw = await this.fetch<{
      changes: {
        old_path: string
        new_path: string
        diff: string
        new_file: boolean
        deleted_file: boolean
        renamed_file: boolean
      }[]
    }>(`/projects/${encoded}/merge_requests/${mrIid}/changes`)

    return raw.changes.map((c) => ({
      oldPath: c.old_path,
      newPath: c.new_path,
      diff: c.diff,
      isNew: c.new_file,
      isDeleted: c.deleted_file,
      isRenamed: c.renamed_file
    }))
  }
}
