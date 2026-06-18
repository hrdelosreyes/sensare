'use client'
import { useState } from 'react'

type Order = Record<string, unknown>
type Product = Record<string, unknown>
type Restock = Record<string, unknown>
type Subscriber = Record<string, unknown>
type Testimonial = Record<string, unknown>

const tabs = ['Orders', 'Products', 'Restock Queue', 'Newsletter', 'Testimonials']

export default function AdminClient({ orders, products, restock, subscribers, testimonials }: {
  orders: Order[]; products: Product[]; restock: Restock[]; subscribers: Subscriber[]; testimonials: Testimonial[]
}) {
  const [tab, setTab] = useState('Orders')

  const paid = orders.filter(o => o.payment_status === 'paid').length
  const revenue = orders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + (o.total_php as number), 0)

  return (
    <div style={{ paddingTop: 72, minHeight: '100vh', background: 'var(--espresso)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontFamily: 'OleoScript', fontSize: 22, color: 'var(--rose-gold)', marginBottom: 4 }}>Sensarè Admin</p>
          <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 32, color: 'var(--cream)' }}>Dashboard</h1>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: 40 }}>
          {[
            { label: 'Total Orders', value: orders.length },
            { label: 'Paid Orders', value: paid },
            { label: 'Revenue', value: `₱${revenue.toLocaleString()}` },
            { label: 'Restock Queue', value: restock.length },
            { label: 'Subscribers', value: subscribers.length },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.15)', borderRadius: 4, padding: '24px 20px' }}>
              <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{s.label}</p>
              <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 28, color: 'var(--rose-gold)' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid rgba(201,144,106,0.15)', flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'PlayfairDisplay', fontSize: 14, letterSpacing: 1,
              color: tab === t ? 'var(--rose-gold)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--rose-gold)' : '2px solid transparent',
              marginBottom: -1,
            }}>
              {t}
            </button>
          ))}
        </div>

        {/* Orders */}
        {tab === 'Orders' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'PlayfairDisplay', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(201,144,106,0.2)' }}>
                  {['Reference', 'Customer', 'Total', 'Payment', 'Fulfillment', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id as string} style={{ borderBottom: '1px solid rgba(201,144,106,0.07)' }}>
                    <td style={{ padding: '14px 12px', color: 'var(--rose-gold)', fontFamily: 'monospace', fontSize: 12 }}>{(o.reference_number as string)?.slice(0, 20)}</td>
                    <td style={{ padding: '14px 12px', color: 'var(--cream)' }}>{o.customer_name as string}</td>
                    <td style={{ padding: '14px 12px', color: 'var(--cream)' }}>₱{(o.total_php as number)?.toFixed(0)}</td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 2, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', background: o.payment_status === 'paid' ? 'rgba(100,200,100,0.15)' : 'rgba(200,100,100,0.15)', color: o.payment_status === 'paid' ? '#90d090' : '#d09090' }}>
                        {o.payment_status as string}
                      </span>
                    </td>
                    <td style={{ padding: '14px 12px', color: 'var(--cream-dim)' }}>{o.fulfillment_status as string}</td>
                    <td style={{ padding: '14px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{new Date(o.created_at as string).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', color: 'var(--text-muted)', padding: 24 }}>No orders yet.</p>}
          </div>
        )}

        {/* Products */}
        {tab === 'Products' && (
          <div>
            {products.map(p => (
              <div key={p.id as string} style={{ background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.15)', borderRadius: 4, padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 18, color: 'var(--cream)', marginBottom: 4 }}>{p.name as string}</p>
                  <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: 'var(--text-muted)' }}>₱{(p.price_php as number)?.toFixed(0)} · Stock: {p.stock_qty as number}</p>
                </div>
                <StockEditor productId={p.id as string} currentStock={p.stock_qty as number} />
              </div>
            ))}
          </div>
        )}

        {/* Restock Queue */}
        {tab === 'Restock Queue' && (
          <div>
            <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              {restock.length} email{restock.length !== 1 ? 's' : ''} waiting for restock notifications.
            </p>
            {restock.map(r => (
              <div key={r.id as string} style={{ background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.1)', borderRadius: 4, padding: '14px 20px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream)' }}>{r.email as string}</span>
                <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: 'var(--text-muted)' }}>{((r.products as Record<string,string>)?.name) || ''}</span>
              </div>
            ))}
            {restock.length === 0 && <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', color: 'var(--text-muted)' }}>No restock requests.</p>}
          </div>
        )}

        {/* Newsletter */}
        {tab === 'Newsletter' && (
          <div>
            <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              {subscribers.length} active subscriber{subscribers.length !== 1 ? 's' : ''}.
            </p>
            {subscribers.map(s => (
              <div key={s.id as string} style={{ background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.1)', borderRadius: 4, padding: '12px 20px', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream)' }}>{s.email as string}</span>
                <span style={{ fontFamily: 'PlayfairDisplay', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(s.subscribed_at as string).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Testimonials */}
        {tab === 'Testimonials' && (
          <div>
            {testimonials.map(t => (
              <div key={t.id as string} style={{ background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.15)', borderRadius: 4, padding: '20px 24px', marginBottom: 12 }}>
                <p style={{ fontFamily: 'PlayfairDisplay', fontStyle: 'italic', fontSize: 15, color: 'var(--cream-dim)', marginBottom: 10 }}>"{t.quote as string}"</p>
                <p style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 13, color: 'var(--rose-gold)' }}>{t.customer_name as string} {t.location ? `· ${t.location}` : ''}</p>
                <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Featured: {t.is_featured ? 'Yes' : 'No'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StockEditor({ productId, currentStock }: { productId: string; currentStock: number }) {
  const [stock, setStock] = useState(currentStock)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch('/api/admin/stock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, stock }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="number" value={stock} onChange={e => setStock(Number(e.target.value))} min={0}
        style={{ width: 80, padding: '8px 12px', background: 'var(--mocha)', border: '1px solid rgba(201,144,106,0.3)', color: 'var(--cream)', fontFamily: 'PlayfairDisplay', fontSize: 14, borderRadius: 2, outline: 'none' }}
      />
      <button onClick={save} disabled={saving} style={{ padding: '8px 16px', background: saved ? 'rgba(100,200,100,0.2)' : 'var(--rose-gold)', border: 'none', color: saved ? '#90d090' : 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 12, cursor: 'pointer', borderRadius: 2 }}>
        {saving ? '…' : saved ? 'Saved' : 'Update Stock'}
      </button>
    </div>
  )
}
