import React, { useEffect, useState } from 'react'
import './MRList.css'
import { MRListItem } from './MRListItem'
import { Spinner } from '../primitives/Spinner'
import { Button } from '../primitives/Button'
import { useMRStore } from '../../store/mrStore'
import { useSettingsStore } from '../../store/settingsStore'

export function MRList() {
  const { mrs, activeMR, page, setMRs, setActiveMR, setPage } = useMRStore()
  const projectId = useSettingsStore((s) => s.projectId)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    async function fetchMRs() {
      setLoading(true)
      setError('')
      try {
        const result = await window.api.gitlab.listMRs(projectId, page)
        if (!cancelled) setMRs(result)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchMRs()
    return () => { cancelled = true }
  }, [projectId, page])

  if (!projectId) {
    return (
      <div className="mr-list__empty">
        <p>Enter a project above to load its open merge requests.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mr-list__empty">
        <Spinner size={22} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mr-list__empty mr-list__empty--error">
        <p>Failed to load MRs</p>
        <span className="mr-list__error-detail">{error}</span>
        <Button variant="secondary" size="sm" onClick={() => setPage(page)}>
          Retry
        </Button>
      </div>
    )
  }

  if (mrs.length === 0) {
    return (
      <div className="mr-list__empty">
        <p>No open merge requests{page > 1 ? ' on this page' : ''}.</p>
        {page > 1 && (
          <Button variant="ghost" size="sm" onClick={() => setPage(page - 1)}>
            ← Previous page
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="mr-list">
      <div className="mr-list__items">
        {mrs.map((mr) => (
          <MRListItem
            key={mr.id}
            mr={mr}
            active={activeMR?.id === mr.id}
            onSelect={() => setActiveMR(mr)}
          />
        ))}
      </div>

      <div className="mr-list__pagination">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          ← Prev
        </Button>
        <span className="mr-list__page">Page {page}</span>
        <Button variant="ghost" size="sm" disabled={mrs.length < 25} onClick={() => setPage(page + 1)}>
          Next →
        </Button>
      </div>
    </div>
  )
}
