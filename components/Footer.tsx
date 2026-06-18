'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setStatus(res.ok ? 'ok' : 'error')
    } catch { setStatus('error') }
  }

  return (
    <footer style={{ background: 'var(--chocolate)', borderTop: '1px solid rgba(201,144,106,0.15)' }}>
      {/* Newsletter band */}
      <div style={{
        background: 'var(--mocha)', padding: '56px 24px', textAlign: 'center',
      }}>
        <p style={{ fontFamily: 'Allura', fontSize: 36, color: 'var(--rose-gold)', marginBottom: 8 }}>
          Begin the Ritual
        </p>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)', marginBottom: 28, maxWidth: 420, margin: '0 auto 28px' }}>
          Subscribe and receive the free <em>Sensarè Ritual Guide</em> — a printable evening guide for couples.
        </p>
        {status === 'ok' ? (
          <p style={{ color: 'var(--rose-gold)', fontFamily: 'PlayfairDisplay', fontSize: 15 }}>
            Thank you. Check your inbox for the Ritual Guide.
          </p>
        ) : (
          <form onSubmit={subscribe} style={{ display: 'flex', gap: 0, maxWidth: 420, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                flex: 1, minWidth: 200, padding: '14px 18px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,144,106,0.3)',
                borderRight: 'none', color: 'var(--cream)', fontFamily: 'PlayfairDisplay', fontSize: 14,
                outline: 'none',
              }}
            />
            <button type="submit" disabled={status === 'loading'} style={{
              padding: '14px 24px', background: 'var(--rose-gold)', border: 'none',
              color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700,
              fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer',
            }}>
              {status === 'loading' ? '...' : 'Subscribe'}
            </button>
          </form>
        )}
      </div>

      {/* Footer body */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '48px 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40,
      }}>
        <div>
          <Image src="/logo-sensare.png" alt="Sensarè" width={80} height={80} style={{ objectFit: 'contain', marginBottom: 12 }} />
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Artisanal dark chocolate infused with ancient botanicals. Handcrafted in the Philippines.
          </p>
        </div>

        <div>
          <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--rose-gold)', marginBottom: 16 }}>Explore</p>
          {[
            { href: '/shop', label: 'Shop' },
            { href: '/the-ritual', label: 'The Ritual' },
            { href: '/about', label: 'Our Story' },
            { href: '/faq', label: 'FAQ' },
            { href: '/contact', label: 'Contact' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{
              display: 'block', marginBottom: 10,
              fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)',
              textDecoration: 'none',
            }}>{l.label}</Link>
          ))}
        </div>

        <div>
          <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--rose-gold)', marginBottom: 16 }}>Info</p>
          {[
            { href: '/shipping', label: 'Shipping & Delivery' },
            { href: '/privacy', label: 'Privacy Policy' },
            { href: '/terms', label: 'Terms of Service' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{
              display: 'block', marginBottom: 10,
              fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)',
              textDecoration: 'none',
            }}>{l.label}</Link>
          ))}
        </div>

        <div>
          <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--rose-gold)', marginBottom: 16 }}>Connect</p>
          <a href="https://www.instagram.com/mysensare/" target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginBottom: 10, fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)', textDecoration: 'none' }}>
            Instagram
          </a>
          <a href="https://www.tiktok.com/@yanachocolateria" target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginBottom: 10, fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)', textDecoration: 'none' }}>
            TikTok
          </a>
          <a href="https://www.facebook.com/p/Sensar%C3%A8-Chocolates-61577149852108/" target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)', textDecoration: 'none' }}>
            Facebook
          </a>
        </div>
      </div>

      <div style={{
        borderTop: '1px solid rgba(201,144,106,0.1)',
        padding: '20px 24px', textAlign: 'center',
        fontFamily: 'PlayfairDisplay', fontSize: 12, color: 'var(--text-muted)',
      }}>
        © {new Date().getFullYear()} Sensarè Chocolates. All rights reserved. Made with love in the Philippines.
      </div>
    </footer>
  )
}
