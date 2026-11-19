import Link from 'next/link'
import { requirePartnerAccessPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { getLocations } from '@/lib/partner-data'
import { addDays, fmtDate, isIsoDate, locationLabel, manilaToday, peso } from '@/lib/partner'
import SalesForm from './SalesForm'

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ date?: string; loc?: string }> }) {
  const { partner, locationIds } = await requirePartnerAccessPage({ allowStaff: true })
  const today = manilaToday()
  const sp = await searchParams
  const date = isIsoDate(sp.date) && sp.date <= today ? sp.date : today
  const allLocations = await getLocations(partner.id)
  const locations = allLocations.filter(l => !locationIds || locationIds.includes(l.id))
  const named = allLocations.length > 1
  if (!locations.length) return <div className="pp-card"><p className="pp-empty">You haven&apos;t been assigned to a branch yet. Ask the account owner.</p></div>
  const loc = locations.find(l => l.id === sp.loc) ?? locations[0]
  const sql = db()

  const [stock, products, dayEntries, recent, settled] = await Promise.all([
    sql<{ product_id: string; on_hand: number }[]>`select product_id, on_hand from sensare_partner_stock where location_id = ${loc.id}`,
    sql<{ id: string; name: string; price_php: number }[]>`select id, name, price_php from sensare_products where is_active order by sort_order`,
    sql<{ product_id: string; units_sold: number; unit_price_php: number | null }[]>`
      select product_id, units_sold, unit_price_php from sensare_partner_sales where location_id = ${loc.id} and sale_date = ${date}::date`,
    sql<{ sale_date: string; units_sold: number; unit_price_php: number | null }[]>`
      select sale_date, units_sold, unit_price_php from sensare_partner_sales
      where location_id = ${loc.id} and sale_date >= ${addDays(today, -13)}::date order by sale_date desc`,
    sql<{ period_from: string; period_to: string }[]>`
      select period_from, period_to from sensare_partner_consignment_settlements
      where partner_id = ${partner.id} and status in ('pending', 'confirmed')
        and period_from <= ${date}::date and period_to >= ${date}::date limit 1`,
  ])

  const onHand = new Map(stock.map(s => [s.product_id, s.on_hand]))
  const entries = new Map(dayEntries.map(e => [e.product_id, e]))
  const rows = products
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
  for (const r of recent) {
    const d = byDay.get(r.sale_date) ?? { units: 0, revenue: 0 }
    d.units += Number(r.units_sold)
    d.revenue += Number(r.units_sold) * Number(r.unit_price_php ?? 0)
    byDay.set(r.sale_date, d)
  }
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, -i))
  const qs = (d: string) => `/partners/portal/sales?date=${d}&loc=${loc.id}`

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="pp-h1">Daily sales</h1>
          <p className="pp-muted">Record how many boxes each branch sold each day. Inventory updates automatically, and your suggested orders follow these numbers.</p>
        </div>
        {locations.length > 1 && (
          <div className="pp-row" role="tablist" aria-label="Branch">
            {locations.map(l => (
              <Link key={l.id} href={`/partners/portal/sales?date=${date}&loc=${l.id}`} className={`pp-btn pp-btn-sm ${l.id === loc.id ? '' : 'pp-btn-ghost'}`}>{locationLabel(l)}</Link>
            ))}
          </div>
        )}
      </div>
      <div className="pp-grid-2">
        <div className="pp-card">
          {settled?.length ? (
            <div className="pp-alert pp-alert-info">Sales on {fmtDate(date)} are part of a consignment settlement ({fmtDate(settled[0].period_from)} – {fmtDate(settled[0].period_to)}) and can&apos;t be changed. Contact us if something needs correcting.</div>
          ) : null}
          {rows.length === 0
            ? <p className="pp-empty">{locations.length > 1 ? `${locationLabel(loc)} has` : 'You have'} no stock to sell yet. Once an order is delivered, you can record sales here.</p>
            : <SalesForm key={`${date}${loc.id}`} date={date} today={today} minDate={addDays(today, -90)} rows={rows} locationId={loc.id} locationName={named ? locationLabel(loc) : null} locked={!!settled?.length} />}
        </div>
        <div className="pp-card">
          <p className="pp-h2">Last 14 days{named ? ` · ${locationLabel(loc)}` : ''}</p>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Date</th><th className="pp-num">Boxes sold</th><th className="pp-num">Sales value</th><th></th></tr></thead>
              <tbody>
                {last14.map(d => {
                  const v = byDay.get(d)
                  return (
                    <tr key={d} style={d === date ? { background: 'rgba(164,82,63,0.08)' } : undefined}>
                      <td>{fmtDate(d)}{d === today && <span className="pp-muted"> · today</span>}</td>
                      <td className="pp-num">{v ? v.units : <span className="pp-muted">—</span>}</td>
                      <td className="pp-num">{v && v.revenue > 0 ? peso(v.revenue, 0) : <span className="pp-muted">—</span>}</td>
                      <td><Link className="pp-link" href={qs(d)} style={{ fontSize: 13 }}>{v ? 'Edit' : 'Add'}</Link></td>
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
