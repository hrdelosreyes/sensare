'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavTabs({ links }: { links: { href: string; label: string; exact?: boolean }[] }) {
  const path = usePathname()
  return (
    <nav className="pp-tabs no-print" aria-label="Section navigation">
      {links.map(l => {
        const active = l.exact ? path === l.href : path === l.href || path.startsWith(l.href + '/')
        return (
          <Link key={l.href} href={l.href} className={`pp-tab ${active ? 'pp-tab-active' : ''}`} aria-current={active ? 'page' : undefined}>
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
