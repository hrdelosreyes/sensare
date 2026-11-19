'use client'
import { useEffect, useState } from 'react'
import { track, canTrack } from '@/lib/pixel'

interface Props {
  productId: string
  productName: string
  price: number
  slug: string
}

type Details = { name: string; email: string; phone: string; address: string; city: string; province: string; notes: string }
const EMPTY: Details = { name: '', email: '', phone: '', address: '', city: '', province: '', notes: '' }
const SAVED_KEY = 'sensare_checkout_details'

const input: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: 'var(--surface)', border: '1px solid rgba(164,82,63,0.3)',
  color: 'var(--cream)', fontFamily: 'PlayfairDisplay', fontSize: 16, borderRadius: 2, outline: 'none',
}
const label: React.CSSProperties = {
  display: 'block', fontFamily: 'PlayfairDisplay', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
  color: 'var(--text-muted)', marginBottom: 6,
}

export default function CheckoutButton({ productId, productName, price }: Props) {
  const [qty, setQty] = useState(1)
  const [step, setStep] = useState<'qty' | 'details'>('qty')
  const [d, setD] = useState<Details>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Remember the buyer's details on this device for next time (optional convenience).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_KEY)
      if (saved) setD({ ...EMPTY, ...JSON.parse(saved), notes: '' })
    } catch {}
  }, [])

  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD(v => ({ ...v, [k]: e.target.value }))
  const subtotal = price * qty
  const shipping = subtotal >= 1000 ? 0 : 100
  const pixelProduct = (value: number) => ({
    content_ids: [productId], content_name: productName, content_type: 'product',
    contents: [{ id: productId, quantity: qty, item_price: price }], num_items: qty, value, currency: 'PHP',
  })

  function startOrder() {
    track('AddToCart', pixelProduct(subtotal))
    setStep('details')
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      try { const { notes: _n, ...keep } = d; localStorage.setItem(SAVED_KEY, JSON.stringify(keep)) } catch {}
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, qty, customer: d }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return }
      if (canTrack()) {
        // Same event ID as the server-side (CAPI) event, so Meta counts it once.
        track('InitiateCheckout', pixelProduct(data.value), data.eventId)
        await new Promise(r => setTimeout(r, 300)) // let the Pixel request leave before we navigate
      }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const button: React.CSSProperties = {
    width: '100%', padding: '18px', background: loading ? 'var(--rose-gold-dark)' : 'var(--rose-gold)',
    border: 'none', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700,
    fontSize: 15, letterSpacing: 2, textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer',
    borderRadius: 2, transition: 'background 0.2s',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(164,82,63,0.3)', borderRadius: 2 }}>
          <button type="button" aria-label="Fewer" onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 40, height: 44, background: 'none', border: 'none', color: 'var(--rose-gold)', fontSize: 20, cursor: 'pointer' }}>−</button>
          <span style={{ width: 40, textAlign: 'center', fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream)' }}>{qty}</span>
          <button type="button" aria-label="More" onClick={() => setQty(q => q + 1)} style={{ width: 40, height: 44, background: 'none', border: 'none', color: 'var(--rose-gold)', fontSize: 20, cursor: 'pointer' }}>+</button>
        </div>
        <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 18, color: 'var(--cream-dim)' }}>
          Total: <strong style={{ color: 'var(--rose-gold)' }}>₱{subtotal.toFixed(0)}</strong>
        </span>
      </div>

      {step === 'qty' ? (
        <button type="button" onClick={startOrder} style={button}>
          Order Now · ₱{subtotal.toFixed(0)}
        </button>
      ) : (
        <form onSubmit={pay} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 4, padding: 20 }}>
          <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 17, color: 'var(--cream)', marginBottom: 4 }}>Where should we send it?</p>
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>We&apos;ll email your order confirmation and use these details for delivery.</p>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
            <label><span style={label}>Full name</span><input style={input} name="name" required maxLength={120} autoComplete="name" value={d.name} onChange={set('name')} /></label>
            <label><span style={label}>Mobile number</span><input style={input} name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="09XX XXX XXXX" value={d.phone} onChange={set('phone')} /></label>
          </div>
          <label style={{ display: 'block', marginTop: 14 }}><span style={label}>Email</span><input style={input} name="email" type="email" required maxLength={200} autoComplete="email" value={d.email} onChange={set('email')} /></label>
          <label style={{ display: 'block', marginTop: 14 }}><span style={label}>Delivery address</span><input style={input} name="address" required maxLength={300} autoComplete="street-address" placeholder="House no., street, barangay" value={d.address} onChange={set('address')} /></label>
          <div style={{ display: 'grid', gap: 14, marginTop: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))' }}>
            <label><span style={label}>City / Municipality</span><input style={input} name="city" required maxLength={100} autoComplete="address-level2" value={d.city} onChange={set('city')} /></label>
            <label><span style={label}>Province</span><input style={input} name="province" required maxLength={100} autoComplete="address-level1" value={d.province} onChange={set('province')} /></label>
          </div>
          <label style={{ display: 'block', marginTop: 14 }}><span style={label}>Notes (optional)</span><textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} name="notes" maxLength={500} placeholder="Gift message, landmark, delivery time…" value={d.notes} onChange={set('notes')} /></label>

          <div style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)', margin: '18px 0 14px', lineHeight: 1.8 }}>
            Subtotal ₱{subtotal.toFixed(0)} · Shipping {shipping ? `₱${shipping}` : 'free'}<br />
            <strong style={{ color: 'var(--cream)' }}>Total ₱{(subtotal + shipping).toFixed(0)}</strong>
            {shipping > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> · free shipping from ₱1,000</span>}
          </div>
          <button type="submit" disabled={loading} style={button}>
            {loading ? 'Redirecting to payment…' : 'Continue to Payment'}
          </button>
          <button type="button" onClick={() => setStep('qty')} style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'PlayfairDisplay', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Back
          </button>
        </form>
      )}

      {error && <p role="alert" style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: 'var(--danger)', marginTop: 10 }}>{error}</p>}
    </div>
  )
}
