import React, { useState } from 'react'
import './Input.css'

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  revealable?: boolean   // for password fields — show/hide toggle
}

export function Input({
  label,
  hint,
  error,
  revealable = false,
  className = '',
  type = 'text',
  id,
  ...rest
}: Props) {
  const [revealed, setRevealed] = useState(false)
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  const resolvedType = revealable ? (revealed ? 'text' : 'password') : type

  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      {label && (
        <label className="field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="field__input-wrap">
        <input
          id={inputId}
          className="field__input"
          type={resolvedType}
          autoComplete="off"
          spellCheck={false}
          {...rest}
        />
        {revealable && (
          <button
            type="button"
            className="field__reveal"
            onClick={() => setRevealed((v) => !v)}
            tabIndex={-1}
            aria-label={revealed ? 'Hide' : 'Show'}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error  && <p className="field__message field__message--error">{error}</p>}
      {!error && hint && <p className="field__message field__message--hint">{hint}</p>}
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}
