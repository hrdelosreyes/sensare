'use client'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { placeOrderAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { PAYMENT_TERMS, PAYMENT_TERMS_HELP, peso, type PaymentTerms } from '@/lib/partner'

type Item = { id: string; name: string; case_size: number; price: number; srp: number }
type Loc = { id: string; name: string }
type Stock = Record<string, { onHand: number; onOrder: number; suggested: number }>

export default function OrderForm({ catalog, locations, defaultTerms, stock, initial, suggestionId }: {
  catalog: Item[]; locations: Loc[]; defaultTerms: PaymentTerms; stock: Stock
  initial: Record<string, number>; suggestionId: string | null
}) {
  const [state, action] = useActionState(placeOrderAction, undefined)
  const [qty, setQty] = useState<Record<string, number>>(initial)
  const [terms, setTerms] = useState<PaymentTerms>(defaultTerms)
  const k = (l: string, p: string) => `${l}_${p}`
  const q = (l: string, p: string) => qty[k(l, p)] || 0
  const set = (l: string, p: string, v: number) => setQty(s => ({ ...s, [k(l, p)]: Math.max(0, Math.min(999, Math.floor(v) || 0)) }))

  const productCases = (p: Item) => locations.reduce((s, l) => s + q(l.id, p.id), 0)
  const locTotal = (l: Loc) => catalog.reduce((s, p) => s + q(l.id, p.id) * p.price, 0)
  const total = catalog.reduce((s, p) => s + productCases(p) * p.price, 0)
  const cases = catalog.reduce((s, p) => s + productCases(p), 0)
  const deliveries = locations.filter(l => catalog.some(p => q(l.id, p.id) > 0))
  const anySuggestion = Object.values(stock).some(s => s.suggested > 0)

  function applySuggestions() {
    const next: Record<string, number> = {}
    for (const l of locations) for (const p of catalog) {
      const s = stock[k(l.id, p.id)]
      if (s?.suggested) next[k(l.id, p.id)] = s.suggested
    }
    setQty(next)
  }

  return (
    <form action={action}>
      {suggestionId && <input type="hidden" name="suggestion_id" value={suggestionId} />}
      <FormMessage state={state} />
      <div className="pp-card">
        <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <p className="pp-h3" style={{ marginBottom: 0 }}>Cases per branch</p>
          <div className="pp-row">
            {anySuggestion && <button type="button" className="pp-btn pp-btn-ghost pp-btn-sm" onClick={applySuggestions}>Fill suggested quantities</button>}
            <Link href="/partners/portal/branches" className="pp-link" style={{ fontSize: 13 }}>Manage branches</Link>
          </div>
        </div>
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="pp-num">Case price</th>
                {locations.map(l => <th key={l.id} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>{l.name}</th>)}
                <th className="pp-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map(p => {
                const perBox = p.price / p.case_size
                return (
                  <tr key={p.id}>
                    <td>
                      <strong style={{ color: 'var(--cream)' }}>{p.name}</strong>
                      <br /><span className="pp-muted" style={{ fontSize: 12 }}>Case of {p.case_size} · {peso(perBox)}/box · SRP {peso(p.srp, 0)} · margin {p.srp > 0 ? Math.round((1 - perBox / p.srp) * 100) : 0}%</span>
                    </td>
                    <td className="pp-num">{peso(p.price)}</td>
                    {locations.map(l => {
                      const s = stock[k(l.id, p.id)]
                      return (
                        <td key={l.id}>
                          <input className="pp-input pp-input-sm" type="number" name={`qty_${l.id}_${p.id}`} min={0} max={999} step={1} inputMode="numeric"
                            value={q(l.id, p.id) || ''} placeholder="0" aria-label={`Cases of ${p.name} for ${l.name}`}
                            onChange={e => set(l.id, p.id, Number(e.target.value))} style={{ width: 72 }} />
                          <div className="pp-hint" style={{ marginTop: 2, whiteSpace: 'nowrap' }}>
                            {s ? `${s.onHand} in stock${s.onOrder ? ` · ${s.onOrder} coming` : ''}` : 'no stock'}
                            {s?.suggested ? <> · <button type="button" className="pp-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12 }} onClick={() => set(l.id, p.id, s.suggested)}>suggest {s.suggested}</button></> : null}
                          </div>
                        </td>
                      )
                    })}
                    <td className="pp-num">{productCases(p)} cs<br /><span className="pp-muted" style={{ fontSize: 12 }}>{peso(productCases(p) * p.price, 0)}</span></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>{cases} case{cases === 1 ? '' : 's'}</td>
                {locations.map(l => <td key={l.id}>{peso(locTotal(l), 0)}</td>)}
                <td className="pp-num">{peso(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="pp-grid-2" style={{ marginTop: 20 }}>
        <div className="pp-card">
          <p className="pp-h3">Payment terms</p>
          {(Object.keys(PAYMENT_TERMS) as PaymentTerms[]).map(t => (
            <label key={t} className="pp-row" style={{ alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer', flexWrap: 'nowrap' }}>
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
          <p className="pp-h3">Summary</p>
          {deliveries.length === 0 ? <p className="pp-muted" style={{ marginBottom: 16 }}>Enter cases above.</p> : (
            <ul style={{ listStyle: 'none', marginBottom: 16 }}>
              {deliveries.map(l => (
                <li key={l.id} className="pp-row" style={{ justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
                  <span>Delivery to {l.name}</span><span>{peso(locTotal(l), 0)}</span>
                </li>
              ))}
            </ul>
          )}
          <label className="pp-field"><span className="pp-label">Notes for Sensarè</span>
            <textarea className="pp-textarea" name="partner_notes" maxLength={1000} placeholder="Preferred delivery dates, etc." style={{ minHeight: 70 }} /></label>
          <SubmitButton pendingText="Placing order…" className="pp-btn pp-btn-block" disabled={cases === 0}>
            Place order{deliveries.length > 1 ? ` · ${deliveries.length} deliveries` : ''} · {peso(total, 0)}
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
