import React from 'react'
import './TitleBar.css'

export function TitleBar() {
  const isMac = window.api?.platform === 'darwin'

  return (
    <div className={`titlebar ${isMac ? 'titlebar--mac' : 'titlebar--win'}`}>
      {!isMac && (
        <span className="titlebar__title">
          <span className="titlebar__dot" />
          CodeSense
        </span>
      )}
    </div>
  )
}
