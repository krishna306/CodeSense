import React, { useState, useRef, useEffect } from 'react'
import './Sidebar.css'
import { MRList } from '../mr/MRList'
import { useSettingsStore } from '../../store/settingsStore'
import { useMRStore } from '../../store/mrStore'

const MAX_RECENT = 10

interface SidebarProps {
  onOpenSettings: () => void
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const { projectId, recentProjects, save } = useSettingsStore()
  const [draft, setDraft] = useState(projectId)
  const [showRecent, setShowRecent] = useState(false)
  const setPage = useMRStore((s) => s.setPage)
  const wrapRef = useRef<HTMLDivElement>(null)

  /* close the recents dropdown on outside click */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setShowRecent(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function loadProject(value: string) {
    const cleaned = value.trim().replace(/^\/+|\/+$/g, '')
    if (!cleaned) return
    setDraft(cleaned)
    setShowRecent(false)
    setPage(1)

    const recents = [cleaned, ...recentProjects.filter((p) => p !== cleaned)].slice(0, MAX_RECENT)
    save({ projectId: cleaned, recentProjects: recents })
  }

  function applyProject(e: React.FormEvent) {
    e.preventDefault()
    loadProject(draft)
  }

  function removeRecent(e: React.MouseEvent, project: string) {
    e.stopPropagation()
    save({ recentProjects: recentProjects.filter((p) => p !== project) })
  }

  return (
    <div className="sidebar">
      <div className="sidebar__project-wrap" ref={wrapRef}>
        <form className="sidebar__project" onSubmit={applyProject}>
          <input
            className="sidebar__project-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => recentProjects.length > 0 && setShowRecent(true)}
            placeholder="group/project or project ID"
            spellCheck={false}
          />
          {recentProjects.length > 0 && (
            <button
              className="sidebar__project-recent-btn"
              type="button"
              aria-label="Recent projects"
              onClick={() => setShowRecent((v) => !v)}
            >
              <ClockIcon />
            </button>
          )}
          <button className="sidebar__project-go" type="submit" aria-label="Load project">
            →
          </button>
        </form>

        {showRecent && recentProjects.length > 0 && (
          <div className="sidebar__recent">
            <div className="sidebar__recent-head">Recent projects</div>
            {recentProjects.map((p) => (
              <div
                key={p}
                className={`sidebar__recent-item ${p === projectId ? 'sidebar__recent-item--active' : ''}`}
                onClick={() => loadProject(p)}
              >
                <span className="sidebar__recent-name">{p}</span>
                <button
                  className="sidebar__recent-remove"
                  aria-label={`Remove ${p} from recents`}
                  onClick={(e) => removeRecent(e, p)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <MRList />

      <div className="sidebar__footer">
        <button className="sidebar__settings-btn" onClick={onOpenSettings}>
          <GearIcon /> Settings
        </button>
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}
