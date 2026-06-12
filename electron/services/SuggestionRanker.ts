import type { Suggestion } from '../../shared/types'

const SEVERITY_SCORE: Record<string, number> = {
  critical: 100,
  error: 75,
  warning: 40,
  info: 10
}

export class SuggestionRanker {
  rank(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>()
    return suggestions
      .filter((s) => {
        const key = `${s.filePath}:${s.line}:${s.title}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((s) => ({ ...s, score: SEVERITY_SCORE[s.severity] ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }

  riskScore(suggestions: Suggestion[]): number {
    if (suggestions.length === 0) return 0
    const total = suggestions.reduce((acc, s) => acc + (SEVERITY_SCORE[s.severity] ?? 0), 0)
    return Math.min(100, Math.round(total / suggestions.length))
  }
}
