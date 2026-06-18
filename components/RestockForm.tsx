'use client'
import { useState } from 'react'

export default function RestockForm({ productId, productName }: { productId: string; productName: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/restock-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, productId }),
      })
      setStatus(res.ok ? 'ok' : 'error')
    } catch { setStatus('error') }
  }

  if (status === 'ok') return (
    <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 13, color: 'var(--rose-gold)', textAlign: 'center', padding: '12px 0' }}>
      We'll notify you when {productName} is back. ♥
    </p>
  )

  return (
    <form onSubmit={submit}>
      <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center', letterSpacing: 0.5 }}>
        Notify me when back in stock
      </p>
      <div style={{ display: 'flex' }}>
        <input
          type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          style={{
            flex: 1, padding: '11px 14px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,144,106,0.3)',
            borderRight: 'none', color: 'var(--cream)', fontFamily: 'PlayfairDisplay', fontSize: 13,
            outline: 'none', borderRadius: '2px 0 0 2px',
          }}
        />
        <button type="submit" disabled={status === 'loading'} style={{
          padding: '11px 14px', background: 'rgba(201,144,106,0.2)', border: '1px solid rgba(201,144,106,0.3)',
          color: 'var(--rose-gold)', fontFamily: 'PlayfairDisplay', fontSize: 12, cursor: 'pointer',
          borderRadius: '0 2px 2px 0', whiteSpace: 'nowrap',
        }}>
          {status === 'loading' ? '...' : 'Notify Me'}
        </button>
      </div>
      {status === 'error' && <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 12, color: '#e07070', marginTop: 6 }}>Something went wrong. Try again.</p>}
    </form>
  )
}
