'use client'
import { useActionState, useState } from 'react'
import { placeOrderAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { PAYMENT_TERMS, PAYMENT_TERMS_HELP, peso, type PaymentTerms } from '@/lib/partner'

type Item = { id: string; name: string; case_size: number; price: number; srp: number }

export default function OrderForm({ catalog, defaultTerms, defaultAddress, suggestions }: {
  catalog: Item[]; defaultTerms: PaymentTerms; defaultAddress: string
  suggestions: Record<string, { onHand: number; suggested: number }>
}) {
  const [state, action] = useActionState(placeOrderAction, undefined)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [terms, setTerms] = useState<PaymentTerms>(defaultTerms)

  const lines = catalog.map(p => ({ ...p, q: qty[p.id] || 0 }))
  const cases = lines.reduce((s, l) => s + l.q, 0)
  const units = lines.reduce((s, l) => s + l.q * l.case_size, 0)
  const total = lines.reduce((s, l) => s + l.q * l.price, 0)

  return (
    <form action={action}>
      <FormMessage state={state} />
      <div className="pp-card">
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr><th>Product</th><th className="pp-num">Case price</th><th className="pp-num">Per box</th><th className="pp-num">Your stock</th><th>Cases</th><th className="pp-num">Line total</th></tr>
            </thead>
            <tbody>
              {lines.map(l => {
                const s = suggestions[l.id]
                const perBox = l.price / l.case_size
                return (
                  <tr key={l.id}>
                    <td>
                      <strong style={{ color: 'var(--cream)' }}>{l.name}</strong>
                      <br /><span className="pp-muted" style={{ fontSize: 12 }}>Case of {l.case_size} · SRP {peso(l.srp, 0)}/box · margin {l.srp > 0 ? Math.round((1 - perBox / l.srp) * 100) : 0}%</span>
                      {s?.suggested ? <><br /><button type="button" className="pp-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }} onClick={() => setQty(q => ({ ...q, [l.id]: s.suggested }))}>Suggested: {s.suggested} case{s.suggested > 1 ? 's' : ''}</button></> : null}
                    </td>
                    <td className="pp-num">{peso(l.price)}</td>
                    <td className="pp-num">{peso(perBox)}</td>
                    <td className="pp-num">{s ? `${s.onHand} units` : '—'}</td>
                    <td>
                      <input className="pp-input pp-input-sm" type="number" name={`qty_${l.id}`} min={0} max={999} step={1} inputMode="numeric"
                        value={l.q || ''} placeholder="0" aria-label={`Cases of ${l.name}`}
                        onChange={e => setQty(q => ({ ...q, [l.id]: Math.max(0, Math.min(999, Math.floor(Number(e.target.value) || 0))) }))} />
                    </td>
                    <td className="pp-num">{peso(l.q * l.price)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={4}>{cases} case{cases === 1 ? '' : 's'} · {units} boxes</td><td>Subtotal</td><td className="pp-num">{peso(total)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="pp-grid-2" style={{ marginTop: 20 }}>
        <div className="pp-card">
          <p className="pp-h3">Payment terms</p>
          {(Object.keys(PAYMENT_TERMS) as PaymentTerms[]).map(t => (
            <label key={t} className="pp-row" style={{ alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer' }}>
              <input type="radio" name="payment_terms" value={t} checked={terms === t} onChange={() => setTerms(t)} style={{ marginTop: 5 }} />
              <span>
                <span style={{ color: 'var(--cream)' }}>{PAYMENT_TERMS[t]}</span>{t === defaultTerms && <span className="pp-badge" style={{ marginLeft: 8 }}>Your default</span>}
                <br /><span className="pp-muted" style={{ fontSize: 13 }}>{PAYMENT_TERMS_HELP[t]}</span>
              </span>
            </label>
          ))}
          {terms !== defaultTerms && <p className="pp-alert pp-alert-warn" style={{ marginBottom: 0 }}>Terms other than your default are subject to approval when we confirm the order.</p>}
        </div>
        <div className="pp-card">
          <label className="pp-field"><span className="pp-label">Deliver to</span>
            <textarea className="pp-textarea" name="shipping_address" defaultValue={defaultAddress} maxLength={500} style={{ minHeight: 70 }} /></label>
          <label className="pp-field"><span className="pp-label">Notes for Sensarè</span>
            <textarea className="pp-textarea" name="partner_notes" maxLength={1000} placeholder="Delivery instructions, preferred date, etc." style={{ minHeight: 70 }} /></label>
          <SubmitButton pendingText="Placing order…" className="pp-btn pp-btn-block" disabled={cases === 0}>
            Place order · {peso(total, 0)}
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
