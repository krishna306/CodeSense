import React from 'react'
import type { Suggestion } from '../../shared/types'

interface Props {
  suggestion: Suggestion
}

export function AIAnnotation({ suggestion }: Props) {
  return (
    <div className={`annotation annotation--${suggestion.severity}`}>
      <span className="annotation__title">{suggestion.title}</span>
      <p className="annotation__body">{suggestion.body}</p>
      <span className="annotation__source">{suggestion.source === 'ai' ? 'AI' : 'Static'}</span>
    </div>
  )
}
