import { requireApprovedPartnerPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { getLocations } from '@/lib/partner-data'
import { getStockPlan, getForecastSettings } from '@/lib/forecast'
import { ADJUSTMENT_REASONS, fmtDate, locationLabel } from '@/lib/partner'
import AdjustForm from './AdjustForm'
import StockTable from '@/components/portal/StockTable'

export default async function InventoryPage() {
  const partner = await requireApprovedPartnerPage()
  const [locations, cfg] = await Promise.all([getLocations(partner.id, false), getForecastSettings()])
  const [plan, moves] = await Promise.all([
    getStockPlan(partner.id, cfg, locations),
    db()<{ id: string; movement_date: string; movement_type: string; reason: string; notes: string | null; qty_change: number
      product_name: string; order_number: string | null; location_name: string }[]>`
      select m.*, p.name as product_name, o.order_number, l.name as location_name
      from sensare_partner_inventory_movements m
      join sensare_products p on p.id = m.product_id
      join sensare_partner_locations l on l.id = m.location_id
      left join sensare_partner_orders o on o.id = m.order_id
      where m.partner_id = ${partner.id}
      order by m.created_at desc limit 80`,
  ])
  const multi = locations.filter(l => l.is_active).length > 1
  const totalOnHand = plan.reduce((s, r) => s + r.on_hand, 0)

  return (
    <div className="pp-stack">
      <div>
        <h1 className="pp-h1">Inventory</h1>
        <p className="pp-muted">
          {totalOnHand.toLocaleString()} boxes on hand{multi ? ` across ${locations.filter(l => l.is_active).length} branches` : ''}.
          Stock is added when an order is delivered and deducted when you record sales. “Days left” uses your recent sales trend; we suggest a reorder when stock won&apos;t last the {cfg.leadTimeDays}-day delivery lead time plus a {cfg.safetyDays}-day buffer.
        </p>
      </div>

      {plan.length === 0 ? <div className="pp-card"><p className="pp-empty">No stock yet — it will appear here once your first order is delivered.</p></div> : (
        locations.filter(l => plan.some(p => p.location_id === l.id)).map(l => (
          <div key={l.id} className="pp-card">
            {multi && <p className="pp-h2">{locationLabel(l)}</p>}
            <StockTable rows={plan.filter(p => p.location_id === l.id)} />
          </div>
        ))
      )}

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Remove stock</p>
          <p className="pp-muted" style={{ marginBottom: 16 }}>Record boxes that were damaged, expired, returned to Sensarè, or missing after a stock count.</p>
          <AdjustForm options={plan.filter(s => s.on_hand > 0).map(s => ({ key: `${s.location_id}|${s.product_id}`, label: `${multi ? `${s.location_name} — ` : ''}${s.product_name} (${s.on_hand} on hand)` }))} />
        </div>
        <div className="pp-card">
          <p className="pp-h2">Stock history</p>
          {!moves.length ? <p className="pp-empty">No movements yet.</p> : (
            <div className="pp-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="pp-table">
                <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="pp-num">Units</th></tr></thead>
                <tbody>
                  {moves.map(m => (
                    <tr key={m.id}>
                      <td>{fmtDate(m.movement_date)}</td>
                      <td>{m.product_name}{multi && <><br /><span className="pp-muted" style={{ fontSize: 12 }}>{m.location_name}</span></>}</td>
                      <td>
                        {m.movement_type === 'delivery' ? `Delivery ${m.order_number ?? ''}` : m.movement_type === 'sale' ? 'Sale' : ADJUSTMENT_REASONS[m.reason] ?? 'Adjustment'}
                        {m.notes && m.movement_type === 'adjustment' && <><br /><span className="pp-muted" style={{ fontSize: 12 }}>{m.notes}</span></>}
                      </td>
                      <td className="pp-num" style={{ color: m.qty_change > 0 ? '#98d898' : 'var(--cream-dim)' }}>{m.qty_change > 0 ? '+' : ''}{m.qty_change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
