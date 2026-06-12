import { create } from 'zustand'
import type { MRSummary } from '../../shared/types'

interface MRState {
  mrs: MRSummary[]
  activeMR: MRSummary | null
  page: number
  setMRs: (mrs: MRSummary[]) => void
  setActiveMR: (mr: MRSummary | null) => void
  setPage: (page: number) => void
}

export const useMRStore = create<MRState>((set) => ({
  mrs: [],
  activeMR: null,
  page: 1,
  setMRs: (mrs) => set({ mrs }),
  setActiveMR: (activeMR) => set({ activeMR }),
  setPage: (page) => set({ page })
}))
