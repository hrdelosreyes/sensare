import { requireApprovedPartnerPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getLowStockDays, getPartnerStock } from '@/lib/partner-data'
import { ADJUSTMENT_REASONS, fmtDate } from '@/lib/partner'
import AdjustForm from './AdjustForm'

export default async function InventoryPage() {
  const partner = await requireApprovedPartnerPage()
  const lowDays = await getLowStockDays()
  const [stock, { data: moves }] = await Promise.all([
    getPartnerStock(partner.id, lowDays),
    supabaseAdmin().from('sensare_partner_inventory_movements')
      .select('*, sensare_products(name), sensare_partner_orders(order_number)')
      .eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(60),
  ])

  return (
    <div className="pp-stack">
      <div>
        <h1 className="pp-h1">Inventory</h1>
        <p className="pp-muted">Stock is added automatically when an order is delivered and deducted when you record sales.</p>
      </div>

      <div className="pp-card">
        {stock.length === 0 ? <p className="pp-empty">No stock yet — it will appear here once your first order is delivered.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Product</th><th className="pp-num">On hand (boxes)</th><th className="pp-num">≈ Cases</th><th className="pp-num">Sold, last 14 days</th><th className="pp-num">Avg / day</th><th className="pp-num">Days of stock</th><th>Status</th></tr></thead>
              <tbody>
                {stock.map(s => {
                  const low = s.on_hand === 0 || (s.days_cover !== null && s.days_cover < lowDays)
                  return (
                    <tr key={s.product_id}>
                      <td>{s.product_name}</td>
                      <td className="pp-num">{s.on_hand}</td>
                      <td className="pp-num">{(s.on_hand / s.case_size).toFixed(1)}</td>
                      <td className="pp-num">{s.sold_last_14}</td>
                      <td className="pp-num">{s.avg_daily.toFixed(1)}</td>
                      <td className="pp-num">{s.days_cover === null ? '—' : Math.floor(s.days_cover)}</td>
                      <td>{s.on_hand === 0 ? <span className="pp-badge pp-badge-bad">Out of stock</span> : low ? <span className="pp-badge pp-badge-warn">Reorder soon</span> : <span className="pp-badge pp-badge-ok">OK</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Remove stock</p>
          <p className="pp-muted" style={{ marginBottom: 16 }}>Record boxes that were damaged, expired, returned to Sensarè, or missing after a stock count.</p>
          <AdjustForm products={stock.filter(s => s.on_hand > 0).map(s => ({ id: s.product_id, name: s.product_name, onHand: s.on_hand }))} />
        </div>
        <div className="pp-card">
          <p className="pp-h2">Stock history</p>
          {!moves?.length ? <p className="pp-empty">No movements yet.</p> : (
            <div className="pp-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="pp-table">
                <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="pp-num">Units</th></tr></thead>
                <tbody>
                  {moves.map(m => (
                    <tr key={m.id}>
                      <td>{fmtDate(m.movement_date)}</td>
                      <td>{m.sensare_products?.name}</td>
                      <td>
                        {m.movement_type === 'delivery' ? `Delivery ${m.sensare_partner_orders?.order_number ?? ''}` : m.movement_type === 'sale' ? 'Sale' : ADJUSTMENT_REASONS[m.reason] ?? 'Adjustment'}
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
