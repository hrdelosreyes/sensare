'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

type NavLink = { href: string; label: string; exact?: boolean }

// Section navigation: tabs on wider screens; on phones, a menu button that
// shows the current section and opens the full list.
export default function NavTabs({ links }: { links: NavLink[] }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const isActive = (l: NavLink) => (l.exact ? path === l.href : path === l.href || path.startsWith(l.href + '/'))
  const current = links.find(isActive) ?? links[0]

  return (
    <>
      <nav className="pp-tabs pp-tabs-desktop no-print" aria-label="Section navigation">
        {links.map(l => {
          const active = isActive(l)
          return (
            <Link key={l.href} href={l.href} className={`pp-tab ${active ? 'pp-tab-active' : ''}`} aria-current={active ? 'page' : undefined}>
              {l.label}
            </Link>
          )
        })}
      </nav>

      <nav className="pp-tabs-mobile no-print" aria-label="Section navigation">
        <button type="button" className="pp-tabs-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <span className="pp-tabs-toggle-label">
            <span className="pp-tabs-toggle-icon" aria-hidden="true">☰</span>
            {current.label}
          </span>
          <span aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </button>
        {open && (
          <ul className="pp-tabs-menu">
            {links.map(l => {
              const active = isActive(l)
              return (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className={`pp-tabs-menu-item ${active ? 'pp-tabs-menu-active' : ''}`} aria-current={active ? 'page' : undefined}>
                    {l.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </>
  )
}
