import Link from 'next/link'
import { requireApprovedPartnerPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getLowStockDays, getPartnerStock } from '@/lib/partner-data'
import { addDays, fmtDate, isIsoDate, manilaToday, peso } from '@/lib/partner'
import SalesForm from './SalesForm'

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const partner = await requireApprovedPartnerPage()
  const today = manilaToday()
  const sp = await searchParams
  const date = isIsoDate(sp.date) && sp.date <= today ? sp.date : today
  const db = supabaseAdmin()

  const [stock, { data: products }, { data: dayEntries }, { data: recent }] = await Promise.all([
    getLowStockDays().then(d => getPartnerStock(partner.id, d)),
    db.from('sensare_products').select('id, name, price_php').eq('is_active', true).order('sort_order'),
    db.from('sensare_partner_sales').select('*').eq('partner_id', partner.id).eq('sale_date', date),
    db.from('sensare_partner_sales').select('sale_date, units_sold, unit_price_php').eq('partner_id', partner.id)
      .gte('sale_date', addDays(today, -13)).order('sale_date', { ascending: false }),
  ])

  const onHand = new Map(stock.map(s => [s.product_id, s.on_hand]))
  const entries = new Map((dayEntries ?? []).map(e => [e.product_id as string, e]))
  // Products the partner stocks, has sold that day, or carries in the catalog.
  const rows = (products ?? [])
    .filter(p => onHand.has(p.id) || entries.has(p.id))
    .map(p => {
      const e = entries.get(p.id)
      return {
        id: p.id, name: p.name, srp: Number(p.price_php),
        onHand: onHand.get(p.id) ?? 0,
        units: e ? Number(e.units_sold) : null,
        price: e?.unit_price_php != null ? Number(e.unit_price_php) : null,
      }
    })

  const byDay = new Map<string, { units: number; revenue: number }>()
  for (const r of recent ?? []) {
    const d = byDay.get(r.sale_date) ?? { units: 0, revenue: 0 }
    d.units += Number(r.units_sold)
    d.revenue += Number(r.units_sold) * Number(r.unit_price_php ?? 0)
    byDay.set(r.sale_date, d)
  }
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, -i))

  return (
    <div className="pp-stack">
      <div>
        <h1 className="pp-h1">Daily sales</h1>
        <p className="pp-muted">Record how many boxes you sold each day. Your inventory updates automatically. You can correct any day in the last 90 days.</p>
      </div>
      <div className="pp-grid-2">
        <div className="pp-card">
          {rows.length === 0
            ? <p className="pp-empty">You don&apos;t have stock to sell yet. Once an order is delivered, you can record sales here.</p>
            : <SalesForm key={date} date={date} today={today} minDate={addDays(today, -90)} rows={rows} />}
        </div>
        <div className="pp-card">
          <p className="pp-h2">Last 14 days</p>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Date</th><th className="pp-num">Boxes sold</th><th className="pp-num">Sales value</th><th></th></tr></thead>
              <tbody>
                {last14.map(d => {
                  const v = byDay.get(d)
                  return (
                    <tr key={d} style={d === date ? { background: 'rgba(201,144,106,0.08)' } : undefined}>
                      <td>{fmtDate(d)}{d === today && <span className="pp-muted"> · today</span>}</td>
                      <td className="pp-num">{v ? v.units : <span className="pp-muted">—</span>}</td>
                      <td className="pp-num">{v && v.revenue > 0 ? peso(v.revenue, 0) : <span className="pp-muted">—</span>}</td>
                      <td><Link className="pp-link" href={`/partners/portal/sales?date=${d}`} style={{ fontSize: 13 }}>{v ? 'Edit' : 'Add'}</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
