import type { Metadata } from 'next'
import JsonLd from '@/components/JsonLd'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Common questions about Sensarè Chocolates — ingredients, usage, shipping, and safety.',
  alternates: { canonical: '/faq' },
}

const faqs = [
  {
    category: 'Usage',
    items: [
      { q: 'How do we enjoy Sensarè?', a: 'Share it as a ritual — 30 minutes to 1 hour before intimacy. Follow the 5-step Sensarè Ritual for the full experience.' },
      { q: 'How many pieces per person?', a: 'One heart-shaped piece per partner, per session. That\'s one full box shared between two people.' },
      { q: 'When will we feel the effects?', a: 'Most couples notice a shift in mood and relaxation within 30–45 minutes. The botanicals work gradually — they\'re not stimulants.' },
    ],
  },
  {
    category: 'Ingredients & Safety',
    items: [
      { q: 'What botanicals are in Sensarè?', a: 'Each piece contains 60% Davao dark chocolate, damiana leaf, maca root, ashwagandha, and ceylon cinnamon — all natural, traditionally used herbs.' },
      { q: 'Is this safe to take regularly?', a: 'Yes. Sensarè is crafted with natural botanicals traditionally used to support vitality, balance, and sensual energy. We recommend one box per session.' },
      { q: 'Is this safe during pregnancy or breastfeeding?', a: 'No. We advise against it. Some botanicals (damiana, maca) are not recommended during pregnancy or lactation. Consult your healthcare provider.' },
      { q: 'Is this vegan?', a: 'Yes. Sensarè contains no dairy, no animal products, and is sweetened naturally.' },
      { q: 'Is this FDA-approved?', a: 'Sensarè is a food product made with natural ingredients — not a medicine or supplement. It is not intended to diagnose, treat, cure, or prevent any condition.' },
    ],
  },
  {
    category: 'Product',
    items: [
      { q: 'Where is Sensarè made?', a: 'Right here in the Philippines, using Davao-grown cacao and handcrafted by passionate chocolatiers.' },
      { q: 'How do I store it?', a: 'Keep it cool and dry, away from direct heat. Ideally under 25°C. Refrigeration not required — but love is.' },
      { q: 'What does it taste like?', a: 'Rich, bold dark chocolate with earthy, slightly herbal undertones. Complex, not bitter. Some customers notice a subtle floral finish from the damiana.' },
    ],
  },
  {
    category: 'Orders & Shipping',
    items: [
      { q: 'Where do you ship?', a: 'Nationwide across the Philippines. Metro Manila orders arrive in 1–3 business days. Provincial orders via LBC, 3–7 business days.' },
      { q: 'Is there free shipping?', a: 'Yes — free delivery on orders ₱1,000 and above.' },
      { q: 'How is it packaged?', a: 'Sensarè is packaged in a premium gift-ready box. It arrives looking exactly as it should for a gift.' },
      { q: 'Can I track my order?', a: 'Yes. You\'ll receive a tracking link by email once your order is dispatched.' },
      { q: 'What is your return policy?', a: 'Due to the perishable nature of our product, we do not accept returns. If your order arrives damaged or incorrect, contact us within 24 hours and we\'ll make it right.' },
    ],
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.flatMap(section =>
    section.items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    }))
  ),
}

export default function FAQPage() {
  return (
    <div style={{ paddingTop: 72 }}>
      <JsonLd data={faqJsonLd} />
      <section style={{ padding: '80px 24px 48px', textAlign: 'center', borderBottom: '1px solid rgba(201,144,106,0.1)' }}>
        <p style={{ fontFamily: 'Allura', fontSize: 32, color: 'var(--rose-gold)', marginBottom: 8 }}>Questions?</p>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--cream)', marginBottom: 16 }}>We've Got Answers</h1>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream-dim)' }}>Can't find what you need? <a href="/contact" style={{ color: 'var(--rose-gold)' }}>Contact us</a>.</p>
      </section>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '64px 24px' }}>
        {faqs.map(section => (
          <div key={section.category} style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--rose-gold)', marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid rgba(201,144,106,0.2)' }}>
              {section.category}
            </h2>
            {section.items.map((item, i) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(201,144,106,0.08)', padding: '24px 0' }}>
                <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 17, color: 'var(--cream)', marginBottom: 10 }}>{item.q}</p>
                <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 15, color: 'var(--cream-dim)', lineHeight: 1.8 }}>{item.a}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
