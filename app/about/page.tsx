import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Our Story',
  description: 'Sensarè was born from a desire to slow down and reconnect. Handcrafted in the Philippines with Davao cacao and ancient botanicals.',
}

export default function AboutPage() {
  return (
    <div style={{ paddingTop: 72 }}>
      <section style={{ padding: '96px 24px 64px', textAlign: 'center', borderBottom: '1px solid rgba(201,144,106,0.1)' }}>
        <p style={{ fontFamily: 'Allura', fontSize: 36, color: 'var(--rose-gold)', marginBottom: 12 }}>Our Story</p>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontStyle: 'italic', fontSize: 'clamp(32px, 5vw, 56px)', color: 'var(--cream)' }}>
          Born from a Desire<br />to Slow Down
        </h1>
      </section>

      {/* Hero image */}
      <div style={{ position: 'relative', height: 480, overflow: 'hidden' }}>
        <Image src="/images/hero-2.png" alt="Sensarè couple" fill style={{ objectFit: 'cover', objectPosition: 'center top' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, var(--espresso) 100%)' }} />
      </div>

      <section style={{ maxWidth: 740, margin: '0 auto', padding: '72px 24px' }}>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 18, color: 'var(--cream-dim)', lineHeight: 2, marginBottom: 32 }}>
          Sensarè began with a question: <em>Why does intimacy feel like something we schedule instead of something we live?</em>
        </p>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream-dim)', lineHeight: 1.9, marginBottom: 28 }}>
          It started with a batch made at home — two heart-shaped pieces of Davao dark chocolate, infused with damiana, maca, and ashwagandha. Herbs that have been used across cultures for centuries to support vitality, calm, and connection. No synthetic compounds. No shortcuts.
        </p>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream-dim)', lineHeight: 1.9, marginBottom: 28 }}>
          The ritual came next. Not just eating chocolate — but unwrapping it slowly, savoring it together, talking. Creating a space where two people could actually arrive in the same room. That felt like the real product.
        </p>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream-dim)', lineHeight: 1.9, marginBottom: 48 }}>
          We're Filipino. We believe in the ritual of sharing food — <em>kain tayo</em> as an act of care. Sensarè is that spirit, expressed through the finest cacao from Davao — the cacao capital of the Philippines — and the wisdom of ancient botanicals from around the world.
        </p>

        <div style={{ border: '1px solid rgba(201,144,106,0.2)', borderRadius: 4, padding: '36px 40px', background: 'var(--mocha)', marginBottom: 48 }}>
          <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 20, color: 'var(--cream)', lineHeight: 1.8, marginBottom: 20 }}>
            "We don't sell chocolate. We sell an excuse to slow down and look at each other."
          </p>
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--rose-gold-dark)' }}>— The Sensarè Chocolatier</p>
        </div>

        <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 24, color: 'var(--cream)', marginBottom: 20 }}>Why Davao Cacao?</h2>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream-dim)', lineHeight: 1.9, marginBottom: 48 }}>
          Davao City produces some of the finest cacao in the world — bold, complex, earthy with hints of fruit and spice. Filipino farmers have been cultivating it for generations. Using Davao cacao isn't just a flavour decision. It's a commitment to our own land and our own people.
        </p>

        <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 24, color: 'var(--cream)', marginBottom: 20 }}>Our Promise</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          {[
            { title: 'No artificial anything', desc: 'Every ingredient is natural, purposeful, and clean.' },
            { title: 'Small batches', desc: 'Made in limited quantities to ensure quality in every piece.' },
            { title: 'Honest botanicals', desc: 'We list every ingredient. No "proprietary blends." No mystery.' },
            { title: 'Made in the Philippines', desc: 'Proudly local. From bean to box.' },
          ].map(p => (
            <div key={p.title} style={{ padding: '20px 0', borderTop: '1px solid rgba(201,144,106,0.15)' }}>
              <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 15, color: 'var(--rose-gold)', marginBottom: 8 }}>{p.title}</p>
              <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)', lineHeight: 1.7 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '64px 24px', textAlign: 'center', background: 'var(--chocolate)', borderTop: '1px solid rgba(201,144,106,0.1)' }}>
        <Link href="/shop" style={{ padding: '16px 40px', background: 'var(--rose-gold)', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
          Shop the Collection
        </Link>
      </section>
    </div>
  )
}
