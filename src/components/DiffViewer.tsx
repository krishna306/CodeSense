import React, { useState } from 'react'
import { useReviewStore } from '../store/reviewStore'
import { AIAnnotation } from './AIAnnotation'
import type { FileDiff } from '../../shared/types'
import './DiffViewer.css'

interface Props {
  files: FileDiff[]
}

export function DiffViewer({ files }: Props) {
  return (
    <div className="diff-viewer">
      {files.map((file) => (
        <FileSection key={file.newPath} file={file} />
      ))}
    </div>
  )
}

/* ── One collapsible section per changed file ──────────────── */

function pathsMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  const na = a.replace(/^\/+/, '')
  const nb = b.replace(/^\/+/, '')
  return na === nb || na.endsWith('/' + nb) || nb.endsWith('/' + na)
}

function FileSection({ file }: { file: FileDiff }) {
  const [open, setOpen] = useState(true)
  const suggestions = useReviewStore((s) => s.suggestions)
  const fileSuggestions = suggestions.filter(
    (s) => pathsMatch(s.filePath, file.newPath) || pathsMatch(s.filePath, file.oldPath)
  )

  const { added, removed } = countChanges(file.diff)

  return (
    <section className="diff-file">
      <button className="diff-file__header" onClick={() => setOpen((v) => !v)}>
        <span className={`diff-file__chevron ${open ? 'diff-file__chevron--open' : ''}`}>▸</span>

        <span className="diff-file__path">
          {file.isRenamed ? (
            <>
              <span className="diff-file__old-path">{file.oldPath}</span>
              {' → '}
              {file.newPath}
            </>
          ) : (
            file.newPath
          )}
        </span>

        {file.isNew     && <span className="diff-file__badge diff-file__badge--new">new</span>}
        {file.isDeleted && <span className="diff-file__badge diff-file__badge--deleted">deleted</span>}
        {file.isRenamed && <span className="diff-file__badge diff-file__badge--renamed">renamed</span>}
        {fileSuggestions.length > 0 && (
          <span className="diff-file__badge diff-file__badge--suggestions">
            {fileSuggestions.length} ⚠
          </span>
        )}

        <span className="diff-file__stats">
          <span className="diff-file__added">+{added}</span>
          <span className="diff-file__removed">−{removed}</span>
        </span>
      </button>

      {open && <FileDiffBody file={file} suggestions={fileSuggestions} />}
    </section>
  )
}

/* ── Diff body with real line numbers from hunk headers ────── */

interface DiffRow {
  kind: 'hunk' | 'add' | 'remove' | 'context'
  oldLine: number | null
  newLine: number | null
  text: string
}

function FileDiffBody({
  file,
  suggestions
}: {
  file: FileDiff
  suggestions: ReturnType<typeof useReviewStore.getState>['suggestions']
}) {
  const rows = parseDiff(file.diff)

  /* suggestions whose line falls inside the visible hunks */
  const visibleLines = new Set(rows.map((r) => r.newLine).filter((n): n is number => n !== null))
  const unmatched = suggestions.filter((s) => !visibleLines.has(s.line))

  return (
    <div className="diff-file__body">
      {rows.map((row, i) => {
        const lineSuggestions =
          row.newLine !== null ? suggestions.filter((s) => s.line === row.newLine) : []
        return (
          <React.Fragment key={i}>
            <div className={`diff-line diff-line--${row.kind}`}>
              <span className="diff-line__num">{row.oldLine ?? ''}</span>
              <span className="diff-line__num">{row.newLine ?? ''}</span>
              <span className="diff-line__sign">
                {row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ''}
              </span>
              <pre className="diff-line__content">{row.text}</pre>
            </div>
            {lineSuggestions.map((s) => (
              <AIAnnotation key={s.id} suggestion={s} />
            ))}
          </React.Fragment>
        )
      })}

      {unmatched.length > 0 && (
        <div className="diff-file__unmatched">
          <div className="diff-file__unmatched-head">
            Findings outside the visible diff context
          </div>
          {unmatched.map((s) => (
            <div key={s.id} className="diff-file__unmatched-item">
              <span className="diff-file__unmatched-line">Line {s.line}</span>
              <AIAnnotation suggestion={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Helpers ───────────────────────────────────────────────── */

function parseDiff(diff: string): DiffRow[] {
  const rows: DiffRow[] = []
  let oldLine = 0
  let newLine = 0

  for (const line of diff.split('\n')) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunk) {
      oldLine = parseInt(hunk[1], 10)
      newLine = parseInt(hunk[2], 10)
      rows.push({ kind: 'hunk', oldLine: null, newLine: null, text: line })
      continue
    }
    if (line.startsWith('+')) {
      rows.push({ kind: 'add', oldLine: null, newLine, text: line.slice(1) })
      newLine++
    } else if (line.startsWith('-')) {
      rows.push({ kind: 'remove', oldLine, newLine: null, text: line.slice(1) })
      oldLine++
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file" — skip
    } else {
      rows.push({ kind: 'context', oldLine, newLine, text: line.slice(1) || line })
      oldLine++
      newLine++
    }
  }
  return rows
}

function countChanges(diff: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) added++
    if (line.startsWith('-') && !line.startsWith('---')) removed++
  }
  return { added, removed }
}
