'use client'
import { useState } from 'react'

interface Props {
  productId: string
  productName: string
  price: number
  slug: string
}

export default function CheckoutButton({ productId, productName, price, slug }: Props) {
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function checkout() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, qty }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(201,144,106,0.3)', borderRadius: 2 }}>
          <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 40, height: 44, background: 'none', border: 'none', color: 'var(--rose-gold)', fontSize: 20, cursor: 'pointer' }}>−</button>
          <span style={{ width: 40, textAlign: 'center', fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream)' }}>{qty}</span>
          <button onClick={() => setQty(q => q + 1)} style={{ width: 40, height: 44, background: 'none', border: 'none', color: 'var(--rose-gold)', fontSize: 20, cursor: 'pointer' }}>+</button>
        </div>
        <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 18, color: 'var(--cream-dim)' }}>
          Total: <strong style={{ color: 'var(--rose-gold)' }}>₱{(price * qty).toFixed(0)}</strong>
        </span>
      </div>

      <button onClick={checkout} disabled={loading} style={{
        width: '100%', padding: '18px', background: loading ? 'var(--rose-gold-dark)' : 'var(--rose-gold)',
        border: 'none', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700,
        fontSize: 15, letterSpacing: 2, textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer',
        borderRadius: 2, transition: 'background 0.2s',
      }}>
        {loading ? 'Redirecting…' : `Order Now · ₱${(price * qty).toFixed(0)}`}
      </button>

      {error && <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: '#e07070', marginTop: 10 }}>{error}</p>}
    </div>
  )
}
