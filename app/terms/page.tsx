import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of Service', alternates: { canonical: '/terms' } }

export default function TermsPage() {
  return (
    <div style={{ paddingTop: 72 }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px' }}>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 36, color: 'var(--cream)', marginBottom: 32 }}>Terms of Service</h1>
        {[
          { title: 'Products', body: 'Sensarè chocolates are food products made with natural botanical ingredients. They are not medicines, supplements, or medical devices. They are not intended to diagnose, treat, cure, or prevent any condition.' },
          { title: 'Age', body: 'Our products are intended for adults 18 years and older.' },
          { title: 'Health', body: 'Do not use if pregnant, breastfeeding, or if you have a known sensitivity to any ingredient. Consult a healthcare provider if uncertain.' },
          { title: 'Orders', body: 'All orders are subject to availability. We reserve the right to cancel orders if stock runs out before fulfilment. In such cases, a full refund will be issued.' },
          { title: 'Returns', body: 'Due to the perishable nature of our product, we do not accept returns. Damaged or incorrect orders will be replaced at no cost — contact us within 24 hours of delivery.' },
          { title: 'Contact', body: 'For any questions, email hello@mysensare.com.' },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 18, color: 'var(--rose-gold)', marginBottom: 10 }}>{s.title}</h2>
            <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 15, color: 'var(--cream-dim)', lineHeight: 1.9 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
