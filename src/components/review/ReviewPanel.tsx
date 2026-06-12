import React, { useEffect, useState } from 'react'
import './ReviewPanel.css'
import { Button } from '../primitives/Button'
import { Spinner } from '../primitives/Spinner'
import { DiffViewer } from '../DiffViewer'
import { RiskScoreBadge } from './RiskScoreBadge'
import { FindingsList } from './FindingsList'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useMRStore } from '../../store/mrStore'
import { useReviewStore } from '../../store/reviewStore'
import { useSettingsStore } from '../../store/settingsStore'
import { buildMarkdownReport } from '../../utils/buildReport'
import { buildHtmlReport } from '../../utils/buildReportHtml'
import type { Suggestion, ReviewResult, FileDiff } from '../../../shared/types'

export function ReviewPanel() {
  const activeMR = useMRStore((s) => s.activeMR)
  const projectId = useSettingsStore((s) => s.projectId)
  const { suggestions, riskScore, status, errorMessage, rawResponse, start, addSuggestion, setComplete, setError, reset } =
    useReviewStore()
  const model = useSettingsStore((s) => s.model)
  const provider = useSettingsStore((s) => s.provider)
  const [showRaw, setShowRaw] = useState(false)
  const [showOverview, setShowOverview] = useState(true)
  const [exported, setExported] = useState('')

  async function exportReport(format: 'md' | 'pdf') {
    if (!activeMR) return
    const input = {
      mr: activeMR,
      files,
      suggestions,
      riskScore,
      model,
      provider,
      rawResponse
    }
    const base = `codesense-review-MR${activeMR.iid}`

    const path =
      format === 'pdf'
        ? await window.api.report.exportPdf(buildHtmlReport(input), `${base}.pdf`)
        : await window.api.report.exportMarkdown(buildMarkdownReport(input), `${base}.md`)

    if (path) {
      setExported(path)
      setTimeout(() => setExported(''), 4000)
    }
  }

  const [files, setFiles] = useState<FileDiff[]>([])
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState('')

  /* Load diff when MR changes */
  useEffect(() => {
    if (!activeMR) return
    let cancelled = false
    reset()
    setFiles([])
    setDiffError('')
    setDiffLoading(true)

    window.api.gitlab
      .getMRDiff(projectId, activeMR.iid)
      .then((d) => { if (!cancelled) setFiles(d) })
      .catch((err) => { if (!cancelled) setDiffError((err as Error).message) })
      .finally(() => { if (!cancelled) setDiffLoading(false) })

    return () => { cancelled = true }
  }, [activeMR?.id])

  /* Subscribe to review stream events once */
  useEffect(() => {
    const onSuggestion = (s: Suggestion) => addSuggestion(s)
    const onComplete = (r: ReviewResult) => setComplete(r.suggestions, r.riskScore, r.rawResponse)
    const onError = (e: { message: string }) => setError(e.message)

    window.api.on('review:suggestion', onSuggestion)
    window.api.on('review:complete', onComplete)
    window.api.on('review:error', onError)

    return () => {
      window.api.off('review:suggestion', onSuggestion)
      window.api.off('review:complete', onComplete)
      window.api.off('review:error', onError)
    }
  }, [])

  if (!activeMR) {
    return (
      <div className="review-panel__empty">
        <EmptyIllustration />
        <p>Select a merge request to view its diff and start a review.</p>
      </div>
    )
  }

  const reviewing = status === 'analyzing' || status === 'fetching'

  return (
    <div className="review-panel">
      {/* ── Header ── */}
      <header className="review-panel__header">
        <div className="review-panel__title-row">
          <h2 className="review-panel__title">{activeMR.title}</h2>
          <a href={activeMR.webUrl} target="_blank" rel="noreferrer" className="review-panel__link">
            !{activeMR.iid} ↗
          </a>
        </div>
        <div className="review-panel__meta">
          <span>@{activeMR.author}</span>
          <code>{activeMR.sourceBranch}</code> → <code>{activeMR.targetBranch}</code>
          <button
            className="review-panel__overview-toggle"
            onClick={() => setShowOverview((v) => !v)}
          >
            {showOverview ? 'Hide overview ▴' : 'Show overview ▾'}
          </button>
        </div>

        {showOverview && (
          <div className="review-panel__overview">
            <div className="review-panel__overview-stats">
              <OverviewStat label="Created" value={formatDate(activeMR.createdAt)} />
              <OverviewStat label="Updated" value={formatDate(activeMR.updatedAt)} />
              <OverviewStat label="Files" value={diffLoading ? '…' : String(files.length)} />
              <OverviewStat
                label="Changes"
                value={diffLoading ? '…' : totalChanges(files)}
              />
            </div>
            {activeMR.description?.trim() ? (
              <div className="review-panel__description markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeMR.description.trim()}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="review-panel__description review-panel__description--empty">
                No description provided.
              </p>
            )}
          </div>
        )}
      </header>

      {/* ── Toolbar ── */}
      <div className="review-panel__toolbar">
        <Button
          onClick={() => {
            start()
            window.api.review.start(projectId, activeMR.iid)
          }}
          loading={reviewing}
          disabled={files.length === 0 || diffLoading}
        >
          {reviewing ? 'Reviewing…' : status === 'complete' ? 'Re-run Review' : 'Start AI Review'}
        </Button>

        {reviewing && (
          <span className="review-panel__progress">
            <Spinner size={13} />
            {suggestions.length === 0
              ? `Analyzing with ${model}…`
              : `${suggestions.length} found — still analyzing…`}
          </span>
        )}

        {status === 'complete' && <RiskScoreBadge score={riskScore} />}
        {!reviewing && suggestions.length > 0 && (
          <span className="review-panel__count">
            {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}
          </span>
        )}
        {status === 'error' && (
          <span className="review-panel__error" title={errorMessage}>
            Review failed: {errorMessage}
          </span>
        )}

        {status === 'complete' && rawResponse && (
          <Button variant="ghost" size="sm" onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? 'Hide AI response' : 'Show AI response'}
          </Button>
        )}

        {status === 'complete' && (
          <>
            <Button variant="secondary" size="sm" onClick={() => exportReport('pdf')}>
              ⬇ Export PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportReport('md')}>
              .md
            </Button>
          </>
        )}
        {exported && <span className="review-panel__exported">Saved ✓</span>}
      </div>

      {/* ── All findings (always visible when present) ── */}
      {suggestions.length > 0 && <FindingsList suggestions={suggestions} />}

      {/* ── Full AI response ── */}
      {status === 'complete' && showRaw && (
        <div className="review-panel__raw">
          <div className="review-panel__raw-head">
            <span>Full model response ({model})</span>
            <Button
              variant="ghost" size="sm"
              onClick={() => navigator.clipboard.writeText(rawResponse)}
            >
              Copy
            </Button>
          </div>
          <pre className="review-panel__raw-body">{rawResponse}</pre>
        </div>
      )}

      {/* ── Diff ── */}
      <div className="review-panel__diff">
        {diffLoading && (
          <div className="review-panel__diff-state"><Spinner size={22} /></div>
        )}
        {diffError && (
          <div className="review-panel__diff-state review-panel__diff-state--error">
            Failed to load diff: {diffError}
          </div>
        )}
        {!diffLoading && !diffError && files.length > 0 && (
          <>
            <div className="review-panel__file-summary">
              {files.length} file{files.length === 1 ? '' : 's'} changed
            </div>
            <DiffViewer files={files} />
          </>
        )}
      </div>
    </div>
  )
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="review-panel__stat">
      <span className="review-panel__stat-label">{label}</span>
      <span className="review-panel__stat-value">{value}</span>
    </span>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function totalChanges(files: FileDiff[]): string {
  let added = 0
  let removed = 0
  for (const f of files) {
    for (const line of f.diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) added++
      if (line.startsWith('-') && !line.startsWith('---')) removed++
    }
  }
  return `+${added} / −${removed}`
}

function EmptyIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" opacity="0.35">
      <rect x="8" y="12" width="48" height="40" rx="6" stroke="var(--color-text-muted)" strokeWidth="2"/>
      <path d="M20 26h24M20 34h16M20 42h20" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
