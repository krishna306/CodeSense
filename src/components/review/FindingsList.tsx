import React, { useState } from 'react'
import './FindingsList.css'
import type { Suggestion } from '../../../shared/types'

const SEVERITY_ORDER: Record<string, number> = { critical: 0, error: 1, warning: 2, info: 3 }

export function FindingsList({ suggestions }: { suggestions: Suggestion[] }) {
  const [open, setOpen] = useState(true)

  if (suggestions.length === 0) return null

  /* group by file, severity-sorted inside each group */
  const byFile = new Map<string, Suggestion[]>()
  for (const s of suggestions) {
    const list = byFile.get(s.filePath) ?? []
    list.push(s)
    byFile.set(s.filePath, list)
  }
  for (const list of byFile.values()) {
    list.sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || a.line - b.line
    )
  }

  return (
    <div className="findings">
      <button className="findings__header" onClick={() => setOpen((v) => !v)}>
        <span className={`findings__chevron ${open ? 'findings__chevron--open' : ''}`}>▸</span>
        All Findings ({suggestions.length})
      </button>

      {open && (
        <div className="findings__body">
          {[...byFile.entries()].map(([filePath, items]) => (
            <div key={filePath} className="findings__file">
              <div className="findings__file-path">{filePath}</div>
              {items.map((s) => (
                <FindingItem key={s.id} suggestion={s} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FindingItem({ suggestion }: { suggestion: Suggestion }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      className={`finding finding--${suggestion.severity}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="finding__row">
        <span className={`finding__sev finding__sev--${suggestion.severity}`}>
          {suggestion.severity}
        </span>
        <span className="finding__line">L{suggestion.line}</span>
        <span className="finding__title">{suggestion.title}</span>
        <span className="finding__source">{suggestion.source === 'ai' ? 'AI' : 'Static'}</span>
      </div>
      {expanded && <div className="finding__body">{suggestion.body}</div>}
    </button>
  )
}
