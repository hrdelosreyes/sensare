export const dynamic = 'force-dynamic'

import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'
import RestockForm from '@/components/RestockForm'

async function getHomeData() {
  const db = supabaseAdmin()
  const [{ data: products }, { data: testimonials }] = await Promise.all([
    db.from('sensare_products').select('*').eq('is_active', true).order('sort_order'),
    db.from('sensare_testimonials').select('*').eq('is_featured', true).order('sort_order'),
  ])
  return { products: products || [], testimonials: testimonials || [] }
}

const ritualSteps = [
  { num: '01', title: 'Set the Scene', body: 'Dim the lights. Light a candle. Put your phones away. Sit close.' },
  { num: '02', title: 'Unwrap with Intention', body: 'Open the box slowly. Appreciate the aroma. Hold the chocolate in your hands.' },
  { num: '03', title: 'Savor Slowly', body: 'Take small bites. Close your eyes. Let it melt. Describe what you taste.' },
  { num: '04', title: 'Touch, Speak, Connect', body: 'Ask: "What do you feel right now?" Let the chocolate be your catalyst.' },
  { num: '05', title: 'Ignite', body: 'Let the evening unfold. Massage, dance, embrace — whatever feels right.' },
]

export default async function HomePage() {
  const { products, testimonials } = await getHomeData()

  return (
    <div>
      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        padding: '120px 24px 80px', textAlign: 'center',
      }}>
        {/* Full-bleed hero image */}
        <Image src="/images/hero.png" alt="Sensarè couple" fill priority
          style={{ objectFit: 'cover', objectPosition: 'center top' }} />
        {/* Dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(15,7,5,0.55) 0%, rgba(15,7,5,0.7) 100%)' }} />
        {/* Decorative wave — top right */}
        <div style={{ position: 'absolute', top: -40, right: -60, width: 520, height: 340, pointerEvents: 'none', opacity: 0.09, filter: 'invert(1) sepia(0.2) brightness(1.5)' }}>
          <Image src="/Asset 1.png" alt="" fill style={{ objectFit: 'contain' }} />
        </div>

        <div style={{ position: 'relative', maxWidth: 720 }}>
          <p style={{ fontFamily: 'Allura', fontSize: 28, color: 'var(--rose-gold)', marginBottom: 16 }}>Handcrafted in the Philippines</p>
          <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontStyle: 'italic', fontSize: 'clamp(42px, 7vw, 80px)', lineHeight: 1.1, color: 'var(--cream)', marginBottom: 24 }}>
            Two Hearts.<br />One Indulgence.
          </h1>
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 18, color: 'var(--cream-dim)', lineHeight: 1.8, maxWidth: 520, margin: '0 auto 40px' }}>
            Artisanal dark chocolate infused with ancient botanicals — crafted to awaken desire, elevate intimacy, and deepen your connection.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/shop" style={{ padding: '16px 40px', background: 'var(--rose-gold)', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
              Shop Now
            </Link>
            <Link href="/the-ritual" style={{ padding: '16px 40px', border: '1px solid rgba(201,144,106,0.5)', color: 'var(--rose-gold-light)', fontFamily: 'PlayfairDisplay', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
              Discover the Ritual
            </Link>
          </div>
          <p style={{ marginTop: 48, fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 13, color: 'var(--text-muted)', letterSpacing: 1 }}>
            60% Davao Dark Chocolate · Natural Botanicals · No Dairy · Vegan
          </p>
        </div>
      </section>

      {/* Products */}
      <section style={{ padding: '96px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ fontFamily: 'Allura', fontSize: 32, color: 'var(--rose-gold)', marginBottom: 8 }}>The Collection</p>
          <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(28px, 4vw, 44px)', color: 'var(--cream)' }}>Choose Your Ritual</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
          {products.map((product: Record<string, unknown>) => (
            <ProductCard key={product.id as string} product={product} />
          ))}
        </div>
      </section>

      {/* Brand story strip */}
      <section style={{ borderTop: '1px solid rgba(201,144,106,0.1)', borderBottom: '1px solid rgba(201,144,106,0.1)', position: 'relative', overflow: 'hidden' }}>
        <Image src="/images/brand-story.png" alt="Ana & Ramon" fill style={{ objectFit: 'cover', objectPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,7,5,0.75)' }} />
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', padding: '80px 24px', position: 'relative' }}>
          <p style={{ fontFamily: 'Allura', fontSize: 36, color: 'var(--rose-gold)', marginBottom: 16 }}>Born from Davao</p>
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 18, fontStyle: 'italic', color: 'var(--cream-dim)', lineHeight: 1.9, marginBottom: 28 }}>
            "I made the first batch for my partner. I wanted something that would slow us both down — something intentional. Davao cacao, ancient herbs, and a lot of love. That's Sensarè."
          </p>
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--rose-gold-dark)' }}>— The Sensarè Chocolatier</p>
          <Link href="/about" style={{ display: 'inline-block', marginTop: 32, fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--rose-gold)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
            Read Our Story
          </Link>
        </div>
      </section>

      {/* Ritual preview */}
      <section style={{ padding: '96px 24px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ fontFamily: 'Allura', fontSize: 32, color: 'var(--rose-gold)', marginBottom: 8 }}>The Sensarè Way</p>
          <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(24px, 4vw, 40px)', color: 'var(--cream)', marginBottom: 16 }}>Unwrap. Savor. Ignite.</h2>
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 15, color: 'var(--cream-dim)', maxWidth: 500, margin: '0 auto' }}>
            Sensarè isn't just chocolate. It's a five-step ritual designed to slow you down and bring you closer.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32 }}>
          {ritualSteps.map(step => (
            <div key={step.num} style={{ textAlign: 'center', padding: '32px 20px' }}>
              <p style={{ fontFamily: 'OleoScript', fontSize: 40, color: 'rgba(201,144,106,0.25)', marginBottom: 8 }}>{step.num}</p>
              <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 16, color: 'var(--rose-gold)', marginBottom: 10 }}>{step.title}</p>
              <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)', lineHeight: 1.7 }}>{step.body}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Link href="/the-ritual" style={{ padding: '14px 36px', border: '1px solid rgba(201,144,106,0.4)', color: 'var(--rose-gold-light)', fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
            Experience the Full Ritual
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section style={{ background: 'var(--chocolate)', padding: '96px 24px', borderTop: '1px solid rgba(201,144,106,0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontFamily: 'Allura', fontSize: 32, color: 'var(--rose-gold)', marginBottom: 8 }}>They Felt It Too</p>
            <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(24px, 4vw, 36px)', color: 'var(--cream)' }}>Real Moments. Real Couples.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, maxWidth: 1100, margin: '0 auto' }}>
            {testimonials.map((t: Record<string, unknown>) => (
              <div key={t.id as string} style={{ background: 'var(--mocha)', padding: '36px 32px', borderRadius: 4, border: '1px solid rgba(201,144,106,0.12)' }}>
                <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 32, color: 'var(--rose-gold)', marginBottom: 12, lineHeight: 1 }}>❝</p>
                <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 16, color: 'var(--cream-dim)', lineHeight: 1.8, marginBottom: 20 }}>{t.quote as string}</p>
                <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 13, color: 'var(--rose-gold)' }}>{t.customer_name as string}</p>
                {(t.location as string) && <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t.location as string}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Botanicals */}
      <section style={{ padding: '80px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative wave — full width */}
        <div style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', width: '110%', height: 120, pointerEvents: 'none', opacity: 0.07, filter: 'invert(1) sepia(0.2) brightness(1.5)' }}>
          <Image src="/Asset 3.png" alt="" fill style={{ objectFit: 'contain' }} />
        </div>
        <p style={{ fontFamily: 'Allura', fontSize: 30, color: 'var(--rose-gold)', marginBottom: 12 }}>What's Inside</p>
        <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 28, color: 'var(--cream)', marginBottom: 40 }}>Ancient Botanicals. Modern Love.</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, maxWidth: 800, margin: '0 auto' }}>
          {[
            { name: 'Davao Dark Chocolate', desc: '60% cacao, bold & complex' },
            { name: 'Damiana', desc: 'Traditional herb for sensual energy' },
            { name: 'Maca Root', desc: 'Andean superfood for vitality' },
            { name: 'Ashwagandha', desc: 'Adaptogen for calm arousal' },
            { name: 'Ceylon Cinnamon', desc: 'Warming spice, enhances circulation' },
            { name: 'Vegan', desc: 'No dairy, no animal products' },
          ].map(item => (
            <div key={item.name} style={{ padding: '20px 28px', border: '1px solid rgba(201,144,106,0.2)', borderRadius: 2, minWidth: 180, flex: '1 1 180px' }}>
              <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 15, color: 'var(--rose-gold)', marginBottom: 6 }}>{item.name}</p>
              <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: 'var(--text-muted)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '100px 24px', textAlign: 'center', background: `radial-gradient(ellipse at center, rgba(201,144,106,0.1) 0%, transparent 70%), var(--mocha)`, borderTop: '1px solid rgba(201,144,106,0.1)', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative wave — centered behind text */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 700, height: 240, pointerEvents: 'none', opacity: 0.08, filter: 'invert(1) sepia(0.2) brightness(1.5)' }}>
          <Image src="/Asset 2.png" alt="" fill style={{ objectFit: 'contain' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <p style={{ fontFamily: 'Allura', fontSize: 40, color: 'var(--rose-gold)', marginBottom: 16 }}>Ready to Begin?</p>
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 17, color: 'var(--cream-dim)', marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Your next intentional evening together starts with two small pieces of chocolate.
          </p>
          <Link href="/shop" style={{ padding: '18px 48px', background: 'var(--rose-gold)', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 15, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
            Shop the Collection
          </Link>
        </div>
      </section>
    </div>
  )
}

const productImages: Record<string, string> = {
  'intimate-indulgence': '/images/product-1.png',
  'ritual-bundle': '/images/product-2.png',
  'lovers-gift-set': '/images/product-3.png',
}

function ProductCard({ product }: { product: Record<string, unknown> }) {
  const isOutOfStock = (product.stock_qty as number) <= 0
  const hasDiscount = product.compare_at_price_php !== null
  const imgSrc = productImages[product.slug as string] || '/images/product-1.png'

  return (
    <div style={{ background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.15)', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 280, position: 'relative', overflow: 'hidden' }}>
        <Image src={imgSrc} alt={product.name as string} fill style={{ objectFit: 'cover', objectPosition: 'center', transition: 'transform 0.4s ease' }} />
        {isOutOfStock && (
          <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(15,7,5,0.85)', padding: '4px 12px', fontFamily: 'PlayfairDisplay', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Sold Out
          </div>
        )}
        {!isOutOfStock && hasDiscount && (
          <div style={{ position: 'absolute', top: 16, right: 16, background: 'var(--rose-gold)', padding: '4px 12px', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--espresso)' }}>
            Save ₱{((product.compare_at_price_php as number) - (product.price_php as number)).toFixed(0)}
          </div>
        )}
      </div>

      <div style={{ padding: '28px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontFamily: 'Allura', fontSize: 18, color: 'var(--rose-gold)', marginBottom: 4 }}>{product.tagline as string}</p>
        <h3 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 22, color: 'var(--cream)', marginBottom: 12 }}>{product.name as string}</h3>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)', lineHeight: 1.7, marginBottom: 20, flex: 1 }}>
          {product.description as string}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 22, color: 'var(--rose-gold)' }}>₱{(product.price_php as number).toFixed(0)}</span>
          {hasDiscount && <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: 10 }}>₱{(product.compare_at_price_php as number).toFixed(0)}</span>}
        </div>
        {isOutOfStock ? (
          <RestockForm productId={product.id as string} productName={product.name as string} />
        ) : (
          <Link href={`/shop/${product.slug}`} style={{ display: 'block', padding: '14px', textAlign: 'center', background: 'var(--rose-gold)', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
            Order Now
          </Link>
        )}
      </div>
    </div>
  )
}
