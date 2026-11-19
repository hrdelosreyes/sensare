import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getPartner } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Partners & Resellers',
  description: 'Carry Sensarè in your store, spa or online shop. Wholesale pricing in cases of 12, flexible payment terms, and a partner portal for orders, inventory and sales.',
  alternates: { canonical: '/partners' },
}

const benefits = [
  { title: 'Partner pricing', body: 'Wholesale pricing set for your business, sold in cases of 12.' },
  { title: 'Flexible terms', body: 'Cash on delivery, consignment, or 30-day terms for qualified partners.' },
  { title: 'Your own portal', body: 'Order online, track deliveries, and see your inventory at a glance.' },
  { title: 'Sales insights', body: 'Log daily sales and get reports, sell-through and reorder reminders.' },
]

const steps = [
  { n: '1', title: 'Apply', body: 'Tell us about your business — it takes about three minutes.' },
  { n: '2', title: 'Get approved', body: 'Our team reviews applications within 1–3 business days.' },
  { n: '3', title: 'Start selling', body: 'Log in, place your first order, and track every box you sell.' },
]

export default async function PartnersPage() {
  const partner = await getPartner()
  const portalHref = partner ? (partner.status === 'approved' ? '/partners/portal' : '/partners/status') : null

  return (
    <div style={{ paddingTop: 72 }}>
      <section className="on-dark" style={{ background: 'var(--band)', position: 'relative', minHeight: 460, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <Image src="/images/box.jpg" alt="" fill sizes="100vw" style={{ objectFit: 'cover', opacity: 0.25 }} preload />
        <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '72px 24px', width: '100%' }}>
          <p style={{ fontFamily: 'Allura', fontSize: 36, color: 'var(--rose-gold)', marginBottom: 8 }}>Partner Program</p>
          <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(32px, 5vw, 56px)', color: 'var(--cream)', maxWidth: 680, lineHeight: 1.15, marginBottom: 20 }}>
            Bring the Sensarè ritual to your customers.
          </h1>
          <p className="pp-text" style={{ maxWidth: 560, marginBottom: 32, fontSize: 17 }}>
            We partner with boutiques, spas, hotels, gift shops and online sellers across the Philippines. Join as a reseller and get partner pricing, flexible terms and a portal that keeps your inventory in check.
          </p>
          <div className="pp-row">
            {portalHref ? (
              <Link href={portalHref} className="pp-btn">Go to Partner Portal</Link>
            ) : (
              <>
                <Link href="/partners/apply" className="pp-btn">Apply to become a partner</Link>
                <Link href="/partners/login" className="pp-btn pp-btn-ghost">Partner login</Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px' }}>
        <h2 className="pp-h2" style={{ fontSize: 28, textAlign: 'center', marginBottom: 36 }}>Why partner with Sensarè</h2>
        <div className="pp-grid">
          {benefits.map(b => (
            <div key={b.title} className="pp-card">
              <p style={{ fontWeight: 700, fontSize: 18, color: 'var(--rose-gold)', marginBottom: 8 }}>{b.title}</p>
              <p className="pp-text">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--chocolate)', borderTop: '1px solid rgba(164,82,63,0.1)', borderBottom: '1px solid rgba(164,82,63,0.1)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 24px' }}>
          <h2 className="pp-h2" style={{ fontSize: 28, textAlign: 'center', marginBottom: 36 }}>How it works</h2>
          <div className="pp-grid">
            {steps.map(s => (
              <div key={s.n} style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'OleoScript', fontSize: 44, color: 'var(--rose-gold)', lineHeight: 1 }}>{s.n}</p>
                <p style={{ fontWeight: 700, fontSize: 18, color: 'var(--cream)', margin: '10px 0 6px' }}>{s.title}</p>
                <p className="pp-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
        <h2 className="pp-h2" style={{ fontSize: 28 }}>Ready to carry Sensarè?</h2>
        <p className="pp-text" style={{ marginBottom: 28 }}>
          Questions first? Email <a className="pp-link" href="mailto:mysensare@gmail.com">mysensare@gmail.com</a>{" "}and we&apos;ll be happy to help.
        </p>
        {!portalHref && <Link href="/partners/apply" className="pp-btn">Start your application</Link>}
      </section>
    </div>
  )
}
