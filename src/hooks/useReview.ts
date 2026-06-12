import { useEffect } from 'react'
import { useReviewStore } from '../store/reviewStore'
import type { Suggestion, ReviewResult } from '../../shared/types'

export function useReview(projectId: string, mrIid: number | null) {
  const { addSuggestion, setComplete, setError, reset } = useReviewStore()

  useEffect(() => {
    if (!mrIid) return

    reset()

    const onSuggestion = (s: Suggestion) => addSuggestion(s)
    const onComplete = (r: ReviewResult) => setComplete(r.suggestions, r.riskScore)
    const onError = (e: { message: string }) => setError(e.message)

    window.api.on('review:suggestion', onSuggestion)
    window.api.on('review:complete', onComplete)
    window.api.on('review:error', onError)

    window.api.review.start(projectId, mrIid)

    return () => {
      window.api.off('review:suggestion', onSuggestion)
      window.api.off('review:complete', onComplete)
      window.api.off('review:error', onError)
    }
  }, [projectId, mrIid])
}
