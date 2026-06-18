export const dynamic = 'force-dynamic'

import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'
import RestockForm from '@/components/RestockForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Artisanal dark chocolate for couples — single bars, bundles, and gift sets infused with ancient botanicals.',
}

export default async function ShopPage() {
  const { data: products } = await supabaseAdmin()
    .from('sensare_products').select('*').eq('is_active', true).order('sort_order')

  return (
    <div style={{ paddingTop: 72 }}>
      <div style={{ padding: '64px 24px 32px', textAlign: 'center', borderBottom: '1px solid rgba(201,144,106,0.1)' }}>
        <p style={{ fontFamily: 'Allura', fontSize: 32, color: 'var(--rose-gold)', marginBottom: 8 }}>The Collection</p>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(32px, 5vw, 56px)', color: 'var(--cream)', marginBottom: 16 }}>Choose Your Ritual</h1>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--cream-dim)', maxWidth: 480, margin: '0 auto' }}>
          Every box is handcrafted with 60% Davao dark chocolate and botanicals that have been used for centuries. No fillers. No shortcuts.
        </p>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 40 }}>
          {(products || []).map((product: Record<string, unknown>) => {
            const isOutOfStock = (product.stock_qty as number) <= 0
            const hasDiscount = product.compare_at_price_php !== null
            const productImages: Record<string, string> = {
              'intimate-indulgence': '/images/product-1.png',
              'ritual-bundle': '/images/product-2.png',
              'lovers-gift-set': '/images/product-3.png',
            }
            const imgSrc = productImages[product.slug as string] || '/images/product-1.png'

            return (
              <div key={product.id as string} style={{ background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.15)', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 320, position: 'relative', overflow: 'hidden' }}>
                  <Image src={imgSrc} alt={product.name as string} fill style={{ objectFit: 'cover', objectPosition: 'center' }} />
                  {isOutOfStock && (
                    <div style={{ position: 'absolute', top: 20, left: 20, background: 'rgba(15,7,5,0.9)', padding: '5px 14px', fontFamily: 'PlayfairDisplay', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Sold Out</div>
                  )}
                  {!isOutOfStock && hasDiscount && (
                    <div style={{ position: 'absolute', top: 20, left: 20, background: 'var(--rose-gold)', padding: '5px 14px', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--espresso)' }}>
                      Save ₱{((product.compare_at_price_php as number) - (product.price_php as number)).toFixed(0)}
                    </div>
                  )}
                </div>

                <div style={{ padding: '32px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontFamily: 'Allura', fontSize: 20, color: 'var(--rose-gold)', marginBottom: 6 }}>{product.tagline as string}</p>
                  <h2 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 26, color: 'var(--cream)', marginBottom: 14 }}>{product.name as string}</h2>
                  <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 15, color: 'var(--cream-dim)', lineHeight: 1.8, marginBottom: 24, flex: 1 }}>{product.description as string}</p>

                  <div style={{ borderTop: '1px solid rgba(201,144,106,0.15)', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                      <span style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 26, color: 'var(--rose-gold)' }}>₱{(product.price_php as number).toFixed(0)}</span>
                      {hasDiscount && <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 15, color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: 10 }}>₱{(product.compare_at_price_php as number).toFixed(0)}</span>}
                    </div>
                    {!isOutOfStock && <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 12, color: 'var(--text-muted)' }}>{product.stock_qty as number} left</span>}
                  </div>

                  {isOutOfStock ? (
                    <RestockForm productId={product.id as string} productName={product.name as string} />
                  ) : (
                    <Link href={`/shop/${product.slug}`} style={{ display: 'block', padding: '16px', textAlign: 'center', background: 'var(--rose-gold)', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none', borderRadius: 2 }}>
                      Order Now
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Trust signals */}
      <div style={{ borderTop: '1px solid rgba(201,144,106,0.1)', padding: '48px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, textAlign: 'center' }}>
          {[
            { icon: '🌿', label: 'All Natural', desc: 'No artificial flavors or preservatives' },
            { icon: '🍫', label: 'Davao Cacao', desc: 'Sourced from the cacao capital of the Philippines' },
            { icon: '🤝', label: 'Handcrafted', desc: 'Made in small batches with care' },
            { icon: '📦', label: 'Gift-Ready', desc: 'Beautifully packaged for giving' },
          ].map(t => (
            <div key={t.label}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</p>
              <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 15, color: 'var(--rose-gold)', marginBottom: 6 }}>{t.label}</p>
              <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
