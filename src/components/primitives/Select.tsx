import React from 'react'
import './Select.css'

interface Option {
  value: string
  label: string
  description?: string
}

interface Props {
  label?: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  hint?: string
}

export function Select({ label, value, options, onChange, hint }: Props) {
  const selected = options.find((o) => o.value === value)

  return (
    <div className="select-field">
      {label && <label className="select-field__label">{label}</label>}
      <div className="select-field__wrap">
        <select
          className="select-field__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="select-field__chevron">▾</span>
      </div>
      {selected?.description && (
        <p className="select-field__description">{selected.description}</p>
      )}
      {hint && <p className="select-field__hint">{hint}</p>}
    </div>
  )
}
