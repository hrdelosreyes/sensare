'use client'
import { useActionState } from 'react'
import { saveSettingsAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'
import { peso, type Product } from '@/lib/partner'
import type { ForecastSettings } from '@/lib/forecast-math'

export default function SettingsForm({ bank, forecast, products }: { bank: string; forecast: ForecastSettings; products: Product[] }) {
  const [state, action] = useActionState(saveSettingsAction, undefined)
  return (
    <ActionForm action={action} className="pp-stack">
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
          <p className="pp-h3">Automatic reorder suggestions</p>
          <div className="pp-grid" style={{ gap: '0 16px', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <label className="pp-field"><span className="pp-label">Lead time (days)</span>
              <input className="pp-input" name="partner_lead_time_days" type="number" min={1} max={90} defaultValue={forecast.leadTimeDays} /></label>
            <label className="pp-field"><span className="pp-label">Order covers (days)</span>
              <input className="pp-input" name="partner_cover_days" type="number" min={1} max={120} defaultValue={forecast.coverDays} /></label>
            <label className="pp-field"><span className="pp-label">Safety buffer (days)</span>
              <input className="pp-input" name="partner_safety_days" type="number" min={0} max={60} defaultValue={forecast.safetyDays} /></label>
          </div>
          <p className="pp-hint">Each day the system forecasts every branch&apos;s daily sales from the last 4 weeks (recent weeks weigh more; rising sales are followed at once). It suggests a reorder when stock + orders on the way won&apos;t last lead time + safety buffer, and orders enough to last lead time + cover + buffer, in whole cases. Partners approve or adjust it.</p>
        </div>
      </div>
      <div><SubmitButton>Save settings</SubmitButton></div>
    </ActionForm>
  )
}
