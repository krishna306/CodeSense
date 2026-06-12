import type { MRSummary, FileDiff, Suggestion } from '../../shared/types'

interface ReportInput {
  mr: MRSummary
  files: FileDiff[]
  suggestions: Suggestion[]
  riskScore: number
  model: string
  provider: string
  rawResponse?: string
}

const SEVERITY_ORDER = ['critical', 'error', 'warning', 'info'] as const
const SEVERITY_COLOR: Record<string, string> = {
  critical: '#c2410c',
  error: '#dc2626',
  warning: '#b45309',
  info: '#2563eb'
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildHtmlReport(input: ReportInput): string {
  const { mr, files, suggestions, riskScore, model, provider, rawResponse } = input

  const riskColor = riskScore >= 70 ? '#dc2626' : riskScore >= 40 ? '#b45309' : '#16a34a'

  const summaryRows = SEVERITY_ORDER
    .map((sev) => {
      const count = suggestions.filter((s) => s.severity === sev).length
      return count > 0
        ? `<tr><td><span class="sev" style="color:${SEVERITY_COLOR[sev]}">${sev}</span></td><td>${count}</td></tr>`
        : ''
    })
    .join('')

  const fileSections = files
    .map((file) => {
      const fileSuggestions = suggestions
        .filter((s) => s.filePath === file.newPath || s.filePath === file.oldPath)
        .sort((a, b) => a.line - b.line)

      const { added, removed } = countChanges(file.diff)
      const badges = [
        file.isNew ? '<span class="badge badge-new">new</span>' : '',
        file.isDeleted ? '<span class="badge badge-del">deleted</span>' : '',
        file.isRenamed ? `<span class="badge badge-ren">renamed</span>` : ''
      ].join(' ')

      const findingsHtml = fileSuggestions
        .map(
          (s) => `
        <div class="finding" style="border-left-color:${SEVERITY_COLOR[s.severity] ?? '#888'}">
          <div class="finding-head">
            <span class="sev" style="color:${SEVERITY_COLOR[s.severity]}">${s.severity}</span>
            <span class="line">Line ${s.line}</span>
            <strong>${esc(s.title)}</strong>
            <span class="source">${s.source === 'ai' ? 'AI review' : 'Static analysis'}</span>
          </div>
          <div class="finding-body">${esc(s.body)}</div>
        </div>`
        )
        .join('')

      const diffHtml = file.diff
        .split('\n')
        .map((line) => {
          const cls = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'rem' : line.startsWith('@@') ? 'hunk' : ''
          return `<div class="dl ${cls}">${esc(line) || '&nbsp;'}</div>`
        })
        .join('')

      return `
      <section class="file">
        <h3 class="file-path">${esc(file.newPath)} ${badges}</h3>
        <p class="file-stats"><span class="plus">+${added}</span> / <span class="minus">−${removed}</span> · ${fileSuggestions.length} finding${fileSuggestions.length === 1 ? '' : 's'}</p>
        ${findingsHtml}
        <div class="diff">${diffHtml}</div>
      </section>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', sans-serif;
    font-size: 12px; line-height: 1.55; color: #1f2937;
    padding: 8px;
  }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #e5e7eb; }
  h3 { font-size: 13px; }
  .gen { color: #6b7280; font-size: 10px; margin-bottom: 16px; }
  table { border-collapse: collapse; margin: 8px 0; }
  td, th { border: 1px solid #e5e7eb; padding: 4px 10px; text-align: left; font-size: 11px; }
  th { background: #f9fafb; }
  .risk { font-size: 16px; font-weight: 800; }
  .sev { font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: .05em; }
  .file { margin: 14px 0; page-break-inside: avoid; }
  .file-path {
    font-family: 'SF Mono', Menlo, monospace; font-size: 11px;
    background: #f3f4f6; padding: 6px 10px; border-radius: 6px 6px 0 0;
    border: 1px solid #e5e7eb; border-bottom: none; word-break: break-all;
  }
  .file-stats { font-size: 10px; color: #6b7280; padding: 4px 10px; border: 1px solid #e5e7eb; border-top: none; border-bottom: none; }
  .plus { color: #16a34a; font-weight: 700; } .minus { color: #dc2626; font-weight: 700; }
  .badge { font-size: 8px; font-weight: 800; text-transform: uppercase; padding: 1px 6px; border-radius: 8px; }
  .badge-new { background: #dcfce7; color: #16a34a; }
  .badge-del { background: #fee2e2; color: #dc2626; }
  .badge-ren { background: #fef3c7; color: #b45309; }
  .finding {
    border: 1px solid #e5e7eb; border-left-width: 3px;
    padding: 8px 10px; margin: 0; page-break-inside: avoid;
  }
  .finding-head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .finding-head .line { font-family: monospace; font-size: 10px; color: #6b7280; }
  .finding-head .source { font-size: 9px; color: #9ca3af; text-transform: uppercase; font-weight: 700; margin-left: auto; }
  .finding-body { margin-top: 5px; color: #374151; white-space: pre-wrap; word-break: break-word; font-size: 11px; }
  .diff {
    font-family: 'SF Mono', Menlo, monospace; font-size: 9px; line-height: 1.5;
    border: 1px solid #e5e7eb; border-radius: 0 0 6px 6px; overflow: hidden;
  }
  .dl { padding: 0 8px; white-space: pre-wrap; word-break: break-all; }
  .dl.add  { background: #f0fdf4; color: #166534; }
  .dl.rem  { background: #fef2f2; color: #991b1b; }
  .dl.hunk { background: #eff6ff; color: #1d4ed8; font-weight: 700; }
  .raw {
    font-family: monospace; font-size: 9px; white-space: pre-wrap; word-break: break-word;
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px;
  }
  a { color: #2563eb; }
</style>
</head>
<body>
  <h1>Code Review Report — ${esc(mr.title)}</h1>
  <p class="gen">Generated by CodeSense on ${new Date().toLocaleString()}</p>

  <h2>Merge Request</h2>
  <table>
    <tr><th>MR</th><td><a href="${esc(mr.webUrl)}">!${mr.iid} — ${esc(mr.title)}</a></td></tr>
    <tr><th>Author</th><td>@${esc(mr.author)}</td></tr>
    <tr><th>Branches</th><td><code>${esc(mr.sourceBranch)}</code> → <code>${esc(mr.targetBranch)}</code></td></tr>
    <tr><th>Created</th><td>${new Date(mr.createdAt).toLocaleString()}</td></tr>
    <tr><th>Files changed</th><td>${files.length}</td></tr>
    <tr><th>Reviewed by</th><td>${esc(provider)} / <code>${esc(model)}</code></td></tr>
    <tr><th>Risk score</th><td><span class="risk" style="color:${riskColor}">${riskScore}/100</span></td></tr>
  </table>

  ${mr.description?.trim() ? `<h2>Description</h2><p>${esc(mr.description.trim())}</p>` : ''}

  <h2>Findings Summary</h2>
  ${suggestions.length === 0
    ? '<p><em>No issues found.</em></p>'
    : `<table><tr><th>Severity</th><th>Count</th></tr>${summaryRows}<tr><th>Total</th><th>${suggestions.length}</th></tr></table>`}

  <h2>Changes &amp; Findings by File</h2>
  ${fileSections}

  ${rawResponse?.trim()
    ? `<h2>Full AI Model Response</h2><div class="raw">${esc(rawResponse.trim())}</div>`
    : ''}
</body>
</html>`
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
