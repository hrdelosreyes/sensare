'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  const links = [
    { href: '/shop', label: 'Shop' },
    { href: '/the-ritual', label: 'The Ritual' },
    { href: '/about', label: 'Our Story' },
    { href: '/faq', label: 'FAQ' },
  ]

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      backgroundColor: 'rgba(15,7,5,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(201,144,106,0.15)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 72,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Image src="/logo-sensare.png" alt="Sensarè" width={44} height={44} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'OleoScript', fontSize: 22, color: 'var(--rose-gold)', letterSpacing: 1 }}>
            Sensarè
          </span>
        </Link>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }} className="hidden md:flex">
          {links.map(l => (
            <Link key={l.href} href={l.href} style={{
              fontFamily: 'PlayfairDisplay', fontSize: 14, letterSpacing: 1.5,
              textTransform: 'uppercase', color: 'var(--cream-dim)',
              textDecoration: 'none', transition: 'color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--rose-gold)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--cream-dim)')}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/shop" style={{
            padding: '10px 24px',
            background: 'var(--rose-gold)',
            color: 'var(--espresso)',
            fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 13,
            letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'none',
            borderRadius: 2, transition: 'background 0.2s',
          }}>
            Shop Now
          </Link>
        </div>

        {/* Mobile burger */}
        <button onClick={() => setOpen(!open)} className="md:hidden"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
          <div style={{ width: 24, height: 2, background: 'var(--rose-gold)', marginBottom: 5 }} />
          <div style={{ width: 24, height: 2, background: 'var(--rose-gold)', marginBottom: 5 }} />
          <div style={{ width: 16, height: 2, background: 'var(--rose-gold)' }} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{
          background: 'var(--chocolate)', padding: '24px',
          borderTop: '1px solid rgba(201,144,106,0.2)',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              style={{
                fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream)',
                textDecoration: 'none', letterSpacing: 1,
              }}>
              {l.label}
            </Link>
          ))}
          <Link href="/shop" onClick={() => setOpen(false)} style={{
            display: 'inline-block', padding: '14px 28px', textAlign: 'center',
            background: 'var(--rose-gold)', color: 'var(--espresso)',
            fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 14,
            letterSpacing: 1.5, textTransform: 'uppercase', textDecoration: 'none',
            borderRadius: 2,
          }}>
            Shop Now
          </Link>
        </div>
      )}
    </nav>
  )
}
