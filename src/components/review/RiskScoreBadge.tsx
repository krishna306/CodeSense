import React from 'react'
import './RiskScoreBadge.css'

export function RiskScoreBadge({ score }: { score: number }) {
  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  return (
    <span className={`risk-badge risk-badge--${level}`}>
      Risk {score}/100
    </span>
  )
}
