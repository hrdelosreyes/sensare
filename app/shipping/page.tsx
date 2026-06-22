import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Shipping & Delivery', alternates: { canonical: '/shipping' } }

export default function ShippingPage() {
  return (
    <div style={{ paddingTop: 72 }}>
      <section style={{ padding: '80px 24px 48px', textAlign: 'center', borderBottom: '1px solid rgba(201,144,106,0.1)' }}>
        <p style={{ fontFamily: 'Allura', fontSize: 28, color: 'var(--rose-gold)', marginBottom: 8 }}>Delivery</p>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--cream)' }}>Shipping & Delivery</h1>
      </section>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '64px 24px' }}>
        {[
          { title: 'Metro Manila', details: ['1–3 business days', 'Flat rate ₱100 shipping', 'Free delivery on orders ₱1,000+'] },
          { title: 'Nationwide (Provincial)', details: ['3–7 business days via LBC', 'Flat rate ₱150 shipping', 'Free delivery on orders ₱1,000+'] },
          { title: 'Packaging', details: ['All orders are packed in our premium gift-ready box', 'Temperature-sensitive — avoid direct sunlight', 'Store under 25°C upon receipt'] },
          { title: 'Tracking', details: ['Tracking number sent via email once dispatched', 'For Metro Manila: same-day or next-day tracking available', 'For provinces: LBC tracking applies'] },
          { title: 'Issues with your order?', details: ['Contact us within 24 hours of delivery at hello@mysensare.com', 'We replace damaged or incorrect orders — no questions asked'] },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid rgba(201,144,106,0.1)' }}>
            <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 20, color: 'var(--rose-gold)', marginBottom: 16 }}>{section.title}</h2>
            {section.details.map(d => (
              <p key={d} style={{ fontFamily: 'PlayfairDisplay', fontSize: 15, color: 'var(--cream-dim)', lineHeight: 1.8, paddingLeft: 16, borderLeft: '2px solid rgba(201,144,106,0.2)', marginBottom: 8 }}>{d}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
