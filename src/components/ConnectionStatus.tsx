import React from 'react'
import './ConnectionStatus.css'
import { Spinner } from './primitives/Spinner'

type Status = 'idle' | 'checking' | 'ok' | 'error'

interface Props {
  status: Status
  label?: string
}

export function ConnectionStatus({ status, label }: Props) {
  const text = label ?? {
    idle:     'Not tested',
    checking: 'Checking…',
    ok:       'Connected',
    error:    'Unreachable',
  }[status]

  return (
    <span className={`conn-status conn-status--${status}`}>
      {status === 'checking' ? (
        <Spinner size={10} />
      ) : (
        <span className="conn-status__dot" aria-hidden="true" />
      )}
      {text}
    </span>
  )
}
