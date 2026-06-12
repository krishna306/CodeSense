import React from 'react'
import './AppLayout.css'

interface Props {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export function AppLayout({ sidebar, children }: Props) {
  return (
    <div className="layout">
      <aside className="layout__sidebar">{sidebar}</aside>
      <main className="layout__main">{children}</main>
    </div>
  )
}
