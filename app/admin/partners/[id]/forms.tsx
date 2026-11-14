'use client'
import { useActionState } from 'react'
import { setPartnerStatusAction, updatePartnerAdminAction, savePartnerPricesAction, adminAdjustInventoryAction } from '../../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { ADJUSTMENT_REASONS, PAYMENT_TERMS, peso, type Partner, type PaymentTerms } from '@/lib/partner'

function TermsSelect({ name = 'default_payment_terms', value }: { name?: string; value: PaymentTerms }) {
  return (
    <select className="pp-select" name={name} defaultValue={value}>
      {(Object.keys(PAYMENT_TERMS) as PaymentTerms[]).map(t => <option key={t} value={t}>{PAYMENT_TERMS[t]}</option>)}
    </select>
  )
}

export function StatusForm({ partner }: { partner: Partner }) {
  const [state, action] = useActionState(setPartnerStatusAction, undefined)
  const s = partner.status
  return (
    <form action={action} className="pp-card" style={{ borderColor: s === 'pending' ? 'rgba(230,180,80,0.4)' : undefined }}>
      <input type="hidden" name="partner_id" value={partner.id} />
      <FormMessage state={state} />
      <p className="pp-h2">{s === 'pending' ? 'Review application' : 'Access'}</p>
      <div className="pp-grid-2" style={{ gap: '0 20px' }}>
        {(s === 'pending' || s === 'rejected') && (
          <label className="pp-field"><span className="pp-label">Default payment terms on approval</span>
            <TermsSelect value={partner.default_payment_terms} /></label>
        )}
        <label className="pp-field"><span className="pp-label">Message to partner (optional, included in the email)</span>
          <input className="pp-input" name="note" maxLength={1000} /></label>
      </div>
      <div className="pp-row">
        {s !== 'approved' && <SubmitButton name="status" value="approved" pendingText="…">{s === 'suspended' ? 'Reactivate' : 'Approve'}</SubmitButton>}
        {s === 'pending' && <SubmitButton name="status" value="rejected" className="pp-btn pp-btn-danger" pendingText="…">Reject</SubmitButton>}
        {s === 'approved' && <SubmitButton name="status" value="suspended" className="pp-btn pp-btn-danger" pendingText="…">Suspend access</SubmitButton>}
        <label className="pp-row pp-muted" style={{ gap: 6 }}><input type="checkbox" name="notify" value="off" /> Don&apos;t email the partner</label>
      </div>
    </form>
  )
}

export function PartnerAdminForm({ partner }: { partner: Partner }) {
  const [state, action] = useActionState(updatePartnerAdminAction, undefined)
  return (
    <form action={action}>
      <input type="hidden" name="partner_id" value={partner.id} />
      <FormMessage state={state} />
      <label className="pp-field"><span className="pp-label">Business name</span>
        <input className="pp-input" name="business_name" defaultValue={partner.business_name} required maxLength={200} /></label>
      <label className="pp-field"><span className="pp-label">TIN</span>
        <input className="pp-input" name="tin" defaultValue={partner.tin ?? ''} maxLength={50} /></label>
      <label className="pp-field"><span className="pp-label">Default payment terms</span>
        <TermsSelect value={partner.default_payment_terms} />
        <span className="pp-hint">Pre-selected on new orders. You can change terms on any individual order.</span></label>
      <label className="pp-field"><span className="pp-label">Consignment settlement period (days)</span>
        <input className="pp-input" name="consignment_period_days" type="number" min={1} max={90} defaultValue={partner.consignment_period_days ?? 7} style={{ maxWidth: 120 }} />
        <span className="pp-hint">How often this partner pays for consignment boxes sold. Default 7.</span></label>
      <label className="pp-field"><span className="pp-label">Internal notes (not visible to partner)</span>
        <textarea className="pp-textarea" name="admin_notes" defaultValue={partner.admin_notes ?? ''} maxLength={2000} /></label>
      <SubmitButton>Save</SubmitButton>
    </form>
  )
}

type PriceItem = { id: string; name: string; case_size: number; srp: number; custom: number | null; fallback: number | null; available: boolean }

export function PriceListForm({ partnerId, items }: { partnerId: string; items: PriceItem[] }) {
  const [state, action] = useActionState(savePartnerPricesAction, undefined)
  return (
    <form action={action}>
      <input type="hidden" name="partner_id" value={partnerId} />
      <FormMessage state={state} />
      <div className="pp-table-wrap">
        <table className="pp-table">
          <thead><tr><th>Product</th><th className="pp-num">Retail value / case</th><th className="pp-num">Default case price</th><th>Partner case price</th><th>Available</th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td>{i.name}<br /><span className="pp-muted" style={{ fontSize: 12 }}>Case of {i.case_size}</span><input type="hidden" name="product_id" value={i.id} /></td>
                <td className="pp-num">{peso(i.srp * i.case_size, 0)}</td>
                <td className="pp-num">{i.fallback != null ? peso(i.fallback, 0) : <span className="pp-muted">not set</span>}</td>
                <td><input className="pp-input pp-input-sm" style={{ width: 120 }} type="number" step="0.01" min="0" name={`price_${i.id}`} defaultValue={i.custom ?? ''} placeholder={i.fallback != null ? String(i.fallback) : 'required'} /></td>
                <td><input type="checkbox" name={`available_${i.id}`} defaultChecked={i.available} aria-label={`${i.name} available`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <p className="pp-empty">No wholesale products. Enable them in Partner Settings.</p>}
      <p className="pp-hint" style={{ margin: '8px 0 14px' }}>A product with no partner price and no default price can&apos;t be ordered.</p>
      <SubmitButton>Save price list</SubmitButton>
    </form>
  )
}

export function AdminAdjustForm({ partnerId, options }: { partnerId: string; options: { key: string; label: string }[] }) {
  const [state, action] = useActionState(adminAdjustInventoryAction, undefined)
  return (
    <form action={action}>
      <input type="hidden" name="partner_id" value={partnerId} />
      <FormMessage state={state} />
      <div className="pp-grid-2" style={{ gap: '0 12px' }}>
        <label className="pp-field"><span className="pp-label">Branch & product</span>
          <select className="pp-select" name="stock_key">{options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
        <label className="pp-field"><span className="pp-label">Boxes (+ add / − remove)</span>
          <input className="pp-input" name="qty" type="number" step={1} required /></label>
        <label className="pp-field"><span className="pp-label">Reason</span>
          <select className="pp-select" name="reason">{Object.entries(ADJUSTMENT_REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="pp-field"><span className="pp-label">Notes</span>
          <input className="pp-input" name="notes" maxLength={500} /></label>
      </div>
      <SubmitButton className="pp-btn pp-btn-sm">Save adjustment</SubmitButton>
    </form>
  )
}
