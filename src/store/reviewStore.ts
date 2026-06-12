import { create } from 'zustand'
import type { Suggestion, ReviewStatus } from '../../shared/types'

interface ReviewState {
  suggestions: Suggestion[]
  riskScore: number
  status: ReviewStatus
  errorMessage: string
  rawResponse: string
  start: () => void
  addSuggestion: (s: Suggestion) => void
  setComplete: (suggestions: Suggestion[], riskScore: number, rawResponse?: string) => void
  setError: (message: string) => void
  reset: () => void
}

export const useReviewStore = create<ReviewState>((set) => ({
  suggestions: [],
  riskScore: 0,
  status: 'idle',
  errorMessage: '',
  rawResponse: '',
  start: () =>
    set({ suggestions: [], riskScore: 0, errorMessage: '', rawResponse: '', status: 'analyzing' }),
  addSuggestion: (s) =>
    set((state) => ({ suggestions: [...state.suggestions, s], status: 'analyzing' })),
  setComplete: (suggestions, riskScore, rawResponse = '') =>
    set({ suggestions, riskScore, rawResponse, status: 'complete' }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  reset: () =>
    set({ suggestions: [], riskScore: 0, status: 'idle', errorMessage: '', rawResponse: '' })
}))
