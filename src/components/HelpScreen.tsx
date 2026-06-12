import React from 'react'
import './HelpScreen.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from './primitives/Button'
import guide from '../docs/USER_GUIDE.md?raw'

interface Props {
  onClose: () => void
}

export function HelpScreen({ onClose }: Props) {
  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help" onClick={(e) => e.stopPropagation()}>
        <header className="help__header">
          <h1>User Guide</h1>
          <Button variant="ghost" size="sm" onClick={onClose}>✕ Close</Button>
        </header>
        <div className="help__body markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
