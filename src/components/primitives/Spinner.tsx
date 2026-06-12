import React from 'react'
import './Spinner.css'

interface Props {
  size?: number
  color?: string
  label?: string
}

export function Spinner({ size = 20, color, label = 'Loading…' }: Props) {
  return (
    <span
      className="spinner"
      style={{ '--spinner-size': `${size}px`, '--spinner-color': color } as React.CSSProperties}
      role="status"
      aria-label={label}
    />
  )
}
