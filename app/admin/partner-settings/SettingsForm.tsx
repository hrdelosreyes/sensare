'use client'
import { useActionState } from 'react'
import { saveSettingsAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { peso, type Product } from '@/lib/partner'

export default function SettingsForm({ bank, lowDays, products }: { bank: string; lowDays: number; products: Product[] }) {
  const [state, action] = useActionState(saveSettingsAction, undefined)
  return (
    <form action={action} className="pp-stack">
      <FormMessage state={state} />
      <div className="pp-card">
        <p className="pp-h2">Wholesale products</p>
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead><tr><th>Product</th><th className="pp-num">Retail price / box</th><th>Case size</th><th>Default case price (₱)</th><th>Sold to partners</th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.name}{!p.is_active && <span className="pp-badge pp-badge-mute" style={{ marginLeft: 8 }}>inactive</span>}<input type="hidden" name="product_id" value={p.id} /></td>
                  <td className="pp-num">{peso(p.price_php, 0)}</td>
                  <td><input className="pp-input pp-input-sm" type="number" min={1} step={1} name={`case_size_${p.id}`} defaultValue={p.case_size ?? 12} /></td>
                  <td><input className="pp-input pp-input-sm" style={{ width: 120 }} type="number" min={0} step="0.01" name={`wholesale_${p.id}`} defaultValue={p.wholesale_case_price_php ?? ''} placeholder="not set" /></td>
                  <td><input type="checkbox" name={`wholesale_on_${p.id}`} defaultChecked={p.is_wholesale} aria-label={`${p.name} sold to partners`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pp-hint" style={{ marginTop: 8 }}>The default case price is used for any partner without a custom price for that product.</p>
      </div>
      <div className="pp-grid-2">
        <div className="pp-card">
          <label className="pp-field"><span className="pp-label">Bank transfer details (shown to partners)</span>
            <textarea className="pp-textarea" name="partner_bank_details" defaultValue={bank} maxLength={2000} style={{ minHeight: 130 }}
              placeholder={'Bank: BDO\nAccount name: Sensarè Chocolates\nAccount no.: 0000 0000 0000'} /></label>
        </div>
        <div className="pp-card">
          <label className="pp-field"><span className="pp-label">Low-stock warning (days of cover)</span>
            <input className="pp-input" name="partner_low_stock_days" type="number" min={1} max={90} defaultValue={lowDays} style={{ maxWidth: 120 }} />
            <span className="pp-hint">Partners get a reorder suggestion when a product will run out within this many days, based on their last 14 days of sales.</span></label>
        </div>
      </div>
      <div><SubmitButton>Save settings</SubmitButton></div>
    </form>
  )
}
