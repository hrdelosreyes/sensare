'use client'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { saveSalesAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { fmtDate } from '@/lib/partner'

type Row = { id: string; name: string; srp: number; onHand: number; units: number | null; price: number | null }

export default function SalesForm({ date, today, minDate, rows, locationId, locationName, locked }: {
  date: string; today: string; minDate: string; rows: Row[]; locationId: string; locationName: string | null; locked: boolean
}) {
  const [state, action] = useActionState(saveSalesAction, undefined)
  const router = useRouter()

  return (
    <form action={action}>
      <input type="hidden" name="location_id" value={locationId} />
      <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <p className="pp-h2" style={{ marginBottom: 0 }}>{locationName ? `${locationName} · ` : ''}{fmtDate(date)}</p>
        <input className="pp-input" type="date" name="sale_date" value={date} min={minDate} max={today} style={{ width: 'auto' }}
          onChange={e => e.target.value && router.push(`/partners/portal/sales?date=${e.target.value}&loc=${locationId}`)} aria-label="Sales date" />
      </div>
      <FormMessage state={state} />
      <fieldset disabled={locked} style={{ border: 'none' }}>
      <div className="pp-table-wrap">
        <table className="pp-table">
          <thead><tr><th>Product</th><th className="pp-num">In stock</th><th>Boxes sold</th><th>Price / box</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.name}<input type="hidden" name="product_id" value={r.id} />{r.units !== null && <input type="hidden" name={`existing_${r.id}`} value="1" />}</td>
                <td className="pp-num">{r.onHand}</td>
                <td><input className="pp-input pp-input-sm" type="number" name={`units_${r.id}`} min={0} step={1} inputMode="numeric"
                  defaultValue={r.units ?? ''} placeholder="0" aria-label={`Boxes of ${r.name} sold`} /></td>
                <td><input className="pp-input pp-input-sm" type="number" name={`price_${r.id}`} min={0} step="0.01"
                  defaultValue={r.price ?? r.srp} aria-label={`Selling price for ${r.name}`} style={{ width: 110 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pp-hint" style={{ margin: '8px 0 16px' }}>Selling price defaults to the suggested retail price. Clear a quantity to remove that day&apos;s entry.</p>
      <label className="pp-field"><span className="pp-label">Notes</span>
        <input className="pp-input" name="notes" maxLength={500} placeholder="Optional — e.g. weekend bazaar" /></label>
      <SubmitButton>Save sales</SubmitButton>
      </fieldset>
    </form>
  )
}
