import React from 'react'
import './MRListItem.css'
import type { MRSummary } from '../../../shared/types'

interface Props {
  mr: MRSummary
  active: boolean
  onSelect: () => void
}

export function MRListItem({ mr, active, onSelect }: Props) {
  return (
    <button
      className={`mr-item ${active ? 'mr-item--active' : ''}`}
      onClick={onSelect}
    >
      <span className="mr-item__title">{mr.title}</span>
      <span className="mr-item__meta">
        <span className="mr-item__iid">!{mr.iid}</span>
        <span className="mr-item__author">@{mr.author}</span>
        <span className="mr-item__age">{relativeTime(mr.updatedAt)}</span>
      </span>
      <span className="mr-item__branches">
        <code>{mr.sourceBranch}</code> → <code>{mr.targetBranch}</code>
      </span>
    </button>
  )
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 60)   return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24)  return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30)   return `${days}d`
  return `${Math.floor(days / 30)}mo`
}
