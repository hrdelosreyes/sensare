import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <div style={{ paddingTop: 72 }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px' }}>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 36, color: 'var(--cream)', marginBottom: 32 }}>Privacy Policy</h1>
        {[
          { title: 'What we collect', body: 'We collect your name, email address, shipping address, and order details when you place an order. We collect your email if you subscribe to our newsletter or sign up for restock notifications.' },
          { title: 'How we use it', body: 'We use your information to fulfil your order, send order confirmations, and (if subscribed) send you the Sensarè Ritual Guide and occasional updates. We do not sell your data to third parties.' },
          { title: 'Payments', body: 'Payments are processed securely by HitPay. We do not store your card or payment details.' },
          { title: 'Cookies', body: 'We use a single session cookie for admin authentication. We do not use tracking or advertising cookies.' },
          { title: 'Contact', body: 'For any privacy questions, email hello@mysensare.com.' },
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
