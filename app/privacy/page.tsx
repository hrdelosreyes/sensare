import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy' } }

export default function PrivacyPage() {
  return (
    <div style={{ paddingTop: 72 }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px' }}>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 36, color: 'var(--cream)', marginBottom: 32 }}>Privacy Policy</h1>
        {[
          { title: 'What we collect', body: 'We collect your name, email address, shipping address, and order details when you place an order. We collect your email if you subscribe to our newsletter or sign up for restock notifications.' },
          { title: 'How we use it', body: 'We use your information to fulfil your order, send order confirmations, and (if subscribed) send you the Sensarè Ritual Guide and occasional updates. We do not sell your data to third parties.' },
          { title: 'Payments', body: 'Payments are processed securely by HitPay. We do not store your card or payment details.' },
          { title: 'Cookies', body: 'We use essential cookies to keep staff and partners signed in and to remember your cookie choice. With your permission only, we also use advertising cookies from Meta (Facebook and Instagram). You choose on your first visit, and you can change your mind any time with "Cookie Settings" at the bottom of every page.' },
          { title: 'Advertising measurement (Meta)', body: 'If you accept advertising cookies, the Meta Pixel on our site tells Meta which pages you view and when you start or complete an order, so we can see which ads work and show them to people likely to be interested. When you place an order, our server also reports the purchase to Meta through its Conversions API, together with your email, mobile number, name, city and province in scrambled (hashed) form, your order value, and your browser\'s IP address and type. Meta uses this to match the purchase to an ad, under Meta\'s own Data Policy. If you decline, none of this is sent. The Pixel never runs on our staff or partner portal pages.' },
          { title: 'Your rights', body: 'Under the Philippine Data Privacy Act of 2012 you may ask to see, correct or delete the personal data we hold about you, or object to its use for advertising. Email us and we will respond promptly.' },
          { title: 'Contact', body: 'For any privacy questions, email mysensare@gmail.com.' },
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
