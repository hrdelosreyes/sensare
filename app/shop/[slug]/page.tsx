import { notFound } from 'next/navigation'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'
import CheckoutButton from '@/components/CheckoutButton'
import RestockForm from '@/components/RestockForm'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabaseAdmin().from('sensare_products').select('name, description').eq('slug', slug).single()
  if (!data) return {}
  return { title: data.name, description: data.description }
}

const botanicals = [
  { name: 'Davao Dark Chocolate (60%)', role: 'Rich base, antioxidant-rich, complex flavour' },
  { name: 'Damiana Leaf', role: 'Traditional Mexican herb historically used to support mood and sensual energy' },
  { name: 'Maca Root', role: 'Andean adaptogen used for centuries to support vitality and stamina' },
  { name: 'Ashwagandha', role: 'Ayurvedic adaptogen that promotes calm, reduces stress, supports arousal' },
  { name: 'Natural Sweetener', role: 'No refined sugar — lightly sweetened' },
]

const faqs = [
  { q: 'When should I take it?', a: 'Share it 30 minutes to 1 hour before your intended intimate moment for best effect.' },
  { q: 'How many pieces per person?', a: 'One heart-shaped piece per partner per session is the recommended dose.' },
  { q: 'Is this safe to take regularly?', a: 'Yes — all botanicals are natural and traditionally used for vitality. Not recommended during pregnancy or breastfeeding.' },
  { q: 'Is this vegan?', a: 'Yes. No dairy, no animal products.' },
  { q: 'Where is it made?', a: 'Right here in the Philippines, using Davao-grown cacao.' },
]

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: product } = await supabaseAdmin()
    .from('products').select('*').eq('slug', slug).eq('is_active', true).single()

  if (!product) notFound()

  const isOutOfStock = product.stock_qty <= 0
  const hasDiscount = product.compare_at_price_php !== null

  return (
    <div style={{ paddingTop: 72 }}>
      {/* Product hero */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 64, alignItems: 'start' }}>
        {/* Image */}
        <div style={{ borderRadius: 4, overflow: 'hidden', position: 'relative', minHeight: 420, border: '1px solid rgba(201,144,106,0.15)' }}>
          <Image
            src={({ 'intimate-indulgence': '/images/product-1.png', 'ritual-bundle': '/images/product-2.png', 'lovers-gift-set': '/images/product-3.png' } as Record<string,string>)[product.slug] || '/images/product-1.png'}
            alt={product.name} fill style={{ objectFit: 'cover', objectPosition: 'center' }}
          />
          {isOutOfStock && (
            <div style={{ position: 'absolute', top: 20, left: 20, background: 'rgba(15,7,5,0.9)', padding: '6px 16px', fontFamily: 'PlayfairDisplay', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Sold Out</div>
          )}
        </div>

        {/* Info */}
        <div>
          <p style={{ fontFamily: 'Allura', fontSize: 24, color: 'var(--rose-gold)', marginBottom: 8 }}>{product.tagline}</p>
          <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(28px, 4vw, 44px)', color: 'var(--cream)', marginBottom: 20 }}>{product.name}</h1>
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream-dim)', lineHeight: 1.9, marginBottom: 28 }}>{product.description}</p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 32 }}>
            <span style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 36, color: 'var(--rose-gold)' }}>₱{product.price_php.toFixed(0)}</span>
            {hasDiscount && <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 18, color: 'var(--text-muted)', textDecoration: 'line-through' }}>₱{product.compare_at_price_php.toFixed(0)}</span>}
          </div>

          {/* Usage note */}
          <div style={{ background: 'var(--mocha)', border: '1px solid rgba(201,144,106,0.2)', borderRadius: 4, padding: '16px 20px', marginBottom: 28 }}>
            <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 14, color: 'var(--cream-dim)', lineHeight: 1.7 }}>
              Best shared <strong style={{ color: 'var(--rose-gold)', fontStyle: 'normal' }}>30 minutes to 1 hour</strong> before your moment together. One piece per partner.
            </p>
          </div>

          {isOutOfStock ? (
            <RestockForm productId={product.id} productName={product.name} />
          ) : (
            <CheckoutButton productId={product.id} productName={product.name} price={product.price_php} slug={product.slug} />
          )}

          <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 12, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
            Free delivery on orders ₱800+. Metro Manila: 1–3 days. Nationwide via LBC.
          </p>

          {/* Disclaimer */}
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 11, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.7, padding: '12px 0', borderTop: '1px solid rgba(201,144,106,0.1)' }}>
            ⚠ Not intended to diagnose, treat, cure, or prevent any condition. Not recommended during pregnancy or breastfeeding. Consult your healthcare provider if you have concerns.
          </p>
        </div>
      </div>

      {/* Botanicals */}
      <section style={{ background: 'var(--chocolate)', padding: '72px 24px', borderTop: '1px solid rgba(201,144,106,0.1)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontFamily: 'Allura', fontSize: 30, color: 'var(--rose-gold)', marginBottom: 8 }}>What's Inside</p>
            <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 28, color: 'var(--cream)' }}>Ingredients & Botanicals</h2>
          </div>
          {botanicals.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 20, padding: '20px 0', borderBottom: '1px solid rgba(201,144,106,0.08)', alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rose-gold)', marginTop: 7, flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 16, color: 'var(--cream)', marginBottom: 4 }}>{b.name}</p>
                <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream-dim)', lineHeight: 1.7 }}>{b.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQs */}
      <section style={{ padding: '72px 24px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontFamily: 'Allura', fontSize: 28, color: 'var(--rose-gold)', marginBottom: 8 }}>Questions?</p>
          <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 28, color: 'var(--cream)' }}>We've Got Answers</h2>
        </div>
        {faqs.map((f, i) => (
          <div key={i} style={{ borderBottom: '1px solid rgba(201,144,106,0.1)', padding: '24px 0' }}>
            <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 17, color: 'var(--rose-gold)', marginBottom: 10 }}>{f.q}</p>
            <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 15, color: 'var(--cream-dim)', lineHeight: 1.8 }}>{f.a}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
