import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Ritual',
  description: 'A five-step intimacy ritual for couples — unwrap, savor, and ignite connection with Sensarè Chocolates.',
}

const steps = [
  {
    num: '01',
    title: 'Set the Scene',
    subtitle: 'Create the Container',
    body: 'Dim the lights. Light a candle. Play something soft. Turn your phones face-down. Sit close enough to touch. This moment belongs to you both — protect it.',
    tip: 'Tip: Use a scent you both love. Jasmine, sandalwood, or ylang-ylang work beautifully alongside dark chocolate.',
    image: '/images/ritual-1.png',
  },
  {
    num: '02',
    title: 'Unwrap with Intention',
    subtitle: 'Begin with Presence',
    body: 'Open the Sensarè box slowly. Notice the colour of the chocolate. Lift it to your nose and breathe. Let each partner select their piece. Make eye contact before you begin.',
    tip: 'Tip: Don\'t rush. The anticipation is part of the ritual.',
    image: '/images/ritual-2.png',
  },
  {
    num: '03',
    title: 'Savor Slowly',
    subtitle: 'Awaken the Senses',
    body: 'Close your eyes. Take a small bite. Let it melt. Describe what you taste to each other — "rich", "earthy", "floral", "warm." There are no wrong answers. Just presence.',
    tip: 'Tip: Let it melt completely before swallowing. The botanicals need time to release.',
    image: '/images/ritual-3.png',
  },
  {
    num: '04',
    title: 'Touch, Speak, Connect',
    subtitle: 'Open the Heart',
    body: 'As the chocolate settles, ask each other: "What do you feel right now?" and "What do you desire this evening?" Listen without judgment. The chocolate creates the space. You fill it.',
    tip: 'Tip: Keep answers simple. You don\'t need to perform. Just be honest.',
    image: '/images/ritual-4.png',
  },
  {
    num: '05',
    title: 'Ignite',
    subtitle: 'Let the Evening Unfold',
    body: 'There is no script for what happens next. A slow dance. A massage. A bath together. A long embrace in silence. Follow what feels natural — you\'ve already done the work of arriving.',
    tip: 'Tip: Repeat this ritual whenever you feel disconnected. Love is a practice.',
    image: '/images/ritual-5.png',
  },
]

export default function RitualPage() {
  return (
    <div style={{ paddingTop: 72 }}>
      {/* Hero */}
      <section style={{
        padding: '96px 24px 80px', textAlign: 'center',
        background: `radial-gradient(ellipse at center top, rgba(201,144,106,0.07) 0%, transparent 60%), var(--espresso)`,
        borderBottom: '1px solid rgba(201,144,106,0.1)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative wave — bottom left */}
        <div style={{ position: 'absolute', bottom: -30, left: -40, width: 380, height: 320, pointerEvents: 'none', opacity: 0.08, filter: 'invert(1) sepia(0.2) brightness(1.5)' }}>
          <Image src="/Asset 4.png" alt="" fill style={{ objectFit: 'contain' }} />
        </div>
        <div style={{ position: 'relative' }}>
        <p style={{ fontFamily: 'Allura', fontSize: 36, color: 'var(--rose-gold)', marginBottom: 12 }}>The Sensarè Ritual</p>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontStyle: 'italic', fontSize: 'clamp(32px, 5vw, 60px)', color: 'var(--cream)', marginBottom: 24 }}>
          Unwrap. Savor. Ignite.
        </h1>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 18, color: 'var(--cream-dim)', maxWidth: 560, margin: '0 auto 16px', lineHeight: 1.8 }}>
          Sensarè isn't just chocolate. It's an invitation — a five-step ritual to slow you down, open you up, and bring you closer.
        </p>
        <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 14, color: 'var(--text-muted)' }}>
          Best practiced 30–60 minutes before intimacy.
        </p>
        </div>
      </section>

      {/* Steps */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px' }}>
        {steps.map((step, i) => (
          <div key={step.num} style={{ marginBottom: 80 }}>
            {/* Step image — full width, cinematic */}
            <div style={{ position: 'relative', height: 360, borderRadius: 4, overflow: 'hidden', marginBottom: 36 }}>
              <Image src={step.image} alt={step.title} fill style={{ objectFit: 'cover', objectPosition: 'center' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,7,5,0.7) 0%, transparent 60%)' }} />
              <p style={{ position: 'absolute', bottom: 20, left: 24, fontFamily: 'OleoScript', fontSize: 56, color: 'rgba(201,144,106,0.5)', lineHeight: 1 }}>{step.num}</p>
            </div>
            {/* Step text */}
            <div style={{ display: 'grid', gridTemplateColumns: i % 2 === 0 ? '1fr 2fr' : '2fr 1fr', gap: 32, alignItems: 'start' }}>
              <div style={{ order: i % 2 === 0 ? 0 : 1 }}>
                <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{step.subtitle}</p>
                <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 28, color: 'var(--rose-gold)' }}>{step.title}</h2>
              </div>
              <div style={{ order: i % 2 === 0 ? 1 : 0 }}>
                <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 17, color: 'var(--cream-dim)', lineHeight: 1.9, marginBottom: 16 }}>{step.body}</p>
                <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 14, color: 'var(--text-muted)', borderLeft: '2px solid rgba(201,144,106,0.3)', paddingLeft: 16 }}>{step.tip}</p>
              </div>
            </div>
            {i < steps.length - 1 && <div style={{ width: '100%', height: 1, background: 'rgba(201,144,106,0.08)', marginTop: 48 }} />}
          </div>
        ))}
      </section>

      {/* CTA */}
      <section style={{
        padding: '80px 24px', textAlign: 'center',
        background: 'var(--mocha)', borderTop: '1px solid rgba(201,144,106,0.1)',
      }}>
        <p style={{ fontFamily: 'Allura', fontSize: 36, color: 'var(--rose-gold)', marginBottom: 16 }}>Begin Tonight</p>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream-dim)', maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.8 }}>
          Everything you need for the ritual comes in one small box. Two pieces. One evening. A deeper connection.
        </p>
        <Link href="/shop" style={{ padding: '16px 40px', background: 'var(--rose-gold)', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
          Shop the Collection
        </Link>
      </section>
    </div>
  )
}
