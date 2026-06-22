import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Order Confirmed' }

export default async function OrderConfirmPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams

  return (
    <div style={{ paddingTop: 72, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 540 }}>
        <p style={{ fontFamily: 'Allura', fontSize: 56, color: 'var(--rose-gold)', marginBottom: 8 }}>♥</p>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(28px, 4vw, 44px)', color: 'var(--cream)', marginBottom: 16 }}>
          Your Order is Confirmed
        </h1>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 17, color: 'var(--cream-dim)', lineHeight: 1.8, marginBottom: 28 }}>
          Thank you for choosing Sensarè. Your ritual is on its way. We'll send a confirmation email shortly.
        </p>
        {ref && (
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: 'var(--text-muted)', marginBottom: 36 }}>
            Order reference: <span style={{ color: 'var(--rose-gold)' }}>{ref}</span>
          </p>
        )}
        <div style={{ background: 'var(--mocha)', border: '1px solid rgba(201,144,106,0.2)', borderRadius: 4, padding: '28px 32px', marginBottom: 36, textAlign: 'left' }}>
          <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 15, color: 'var(--rose-gold)', marginBottom: 12 }}>While you wait...</p>
          <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 15, color: 'var(--cream-dim)', lineHeight: 1.8 }}>
            Set the scene. Choose the music. Light the candle. Your Sensarè is coming — the ritual begins with the intention.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/pages/the-sensare-ritual" style={{ padding: '14px 28px', border: '1px solid rgba(201,144,106,0.4)', color: 'var(--rose-gold-light)', fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
            Read the Ritual Guide
          </Link>
          <Link href="/shop" style={{ padding: '14px 28px', background: 'var(--rose-gold)', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
            Shop Again
          </Link>
        </div>
      </div>
    </div>
  )
}
