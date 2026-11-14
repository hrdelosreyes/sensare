'use client'
import { useActionState } from 'react'
import { adjustInventoryAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { ADJUSTMENT_REASONS } from '@/lib/partner'

export default function AdjustForm({ products }: { products: { id: string; name: string; onHand: number }[] }) {
  const [state, action] = useActionState(adjustInventoryAction, undefined)
  if (!products.length) return <p className="pp-empty">No stock on hand to adjust.</p>
  return (
    <form action={action}>
      <FormMessage state={state} />
      <div className="pp-grid-2" style={{ gap: '0 16px' }}>
        <label className="pp-field"><span className="pp-label">Product</span>
          <select className="pp-select" name="product_id" required>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.onHand} on hand)</option>)}
          </select></label>
        <label className="pp-field"><span className="pp-label">Boxes to remove</span>
          <input className="pp-input" name="qty" type="number" min={1} step={1} required /></label>
        <label className="pp-field"><span className="pp-label">Reason</span>
          <select className="pp-select" name="reason" required>
            {Object.entries(ADJUSTMENT_REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label className="pp-field"><span className="pp-label">Expiry date (if any)</span>
          <input className="pp-input" name="expiry_date" type="date" /></label>
      </div>
      <label className="pp-field"><span className="pp-label">Notes</span>
        <input className="pp-input" name="notes" maxLength={500} /></label>
      <SubmitButton>Save adjustment</SubmitButton>
    </form>
  )
}
