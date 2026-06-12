import type { IpcMain } from 'electron'
import { GitLabService } from '../services/GitLabService'
import { getGitLabBaseUrl, getSelectedModel, getSelectedProvider } from '../utils/settings'
import { AnthropicService } from '../services/AnthropicService'
import { OpenAICompatService } from '../services/OpenAICompatService'
import { ContextEnricher } from '../services/ContextEnricher'
import { StaticAnalyzer } from '../services/StaticAnalyzer'
import { SuggestionRanker } from '../services/SuggestionRanker'
import { keyAccount } from './auth.ipc'
import type { Suggestion } from '../../shared/types'
import keytar from 'keytar'

const SERVICE = 'codesense'

interface AIReviewer {
  review(
    diff: string,
    onSuggestion: (s: Suggestion) => void
  ): Promise<{ suggestions: Suggestion[]; raw: string }>
}

async function buildReviewer(): Promise<AIReviewer> {
  const provider = getSelectedProvider()
  const model = getSelectedModel()
  const key = await keytar.getPassword(SERVICE, keyAccount(provider))
  if (!key) throw new Error(`No API key saved for provider "${provider}" — add one in Settings`)

  if (provider === 'anthropic') return new AnthropicService(key, model)
  if (provider === 'openai' || provider === 'xai' || provider === 'gemini')
    return new OpenAICompatService(provider, key, model)
  throw new Error(`Unknown AI provider: ${provider}`)
}

export function registerReviewHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('review:start', async (event, projectId: string, mrIid: number) => {
    const gitlabToken = await keytar.getPassword(SERVICE, 'gitlab-token')
    if (!gitlabToken) throw new Error('GitLab token not configured')

    const emit = (channel: string, payload: unknown) => event.sender.send(channel, payload)

    const gitlab = new GitLabService(gitlabToken, getGitLabBaseUrl())
    const enricher = new ContextEnricher()
    const staticAnalyzer = new StaticAnalyzer()
    const ranker = new SuggestionRanker()

    try {
      const reviewer = await buildReviewer()

      const files = await gitlab.getMRDiff(projectId, mrIid)
      const combined = files
        .map((f) => `=== File: ${f.newPath} ===\n${f.diff}`)
        .join('\n\n')
      const enriched = await enricher.enrich(combined)

      const [staticSuggestions, aiResult] = await Promise.all([
        staticAnalyzer.analyze(enriched),
        reviewer.review(enriched, (suggestion) => emit('review:suggestion', suggestion))
      ])

      console.log(
        `[review] provider=${getSelectedProvider()} model=${getSelectedModel()} ` +
        `files=${files.length} aiSuggestions=${aiResult.suggestions.length} static=${staticSuggestions.length}`
      )
      const ranked = ranker.rank([...staticSuggestions, ...aiResult.suggestions])
      emit('review:complete', {
        mrIid,
        suggestions: ranked,
        riskScore: ranker.riskScore(ranked),
        rawResponse: aiResult.raw
      })
    } catch (err) {
      console.error('[review:start] failed:', err)
      emit('review:error', { message: (err as Error).message })
    }
  })

  ipcMain.handle('review:cancel', () => {
    // TODO: implement cancellation token
  })
}
