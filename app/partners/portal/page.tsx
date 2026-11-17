import Link from 'next/link'
import { requireApprovedPartnerPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { getLocations } from '@/lib/partner-data'
import { ensureFreshSuggestion, getStockPlan } from '@/lib/forecast'
import { getConsignmentState } from '@/lib/consignment'
import { addDays, balance, fmtDate, isOverdue, manilaToday, peso, PAYMENT_TERMS, type PartnerOrder } from '@/lib/partner'
import { OrderStatusBadge, PaymentStatusBadge, Stat } from '@/components/portal/ui'

export default async function PortalDashboard({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const partner = await requireApprovedPartnerPage()
  const { reset } = await searchParams
  const sql = db()
  const today = manilaToday()

  // Keep the suggestion current when the partner checks in (cheap, per partner).
  await ensureFreshSuggestion(partner)
  const locations = await getLocations(partner.id)
  const [sugLines, orders, plan, [{ units7 }], todaySales, consignment] = await Promise.all([
    sql<{ suggested_cases: number; location_id: string }[]>`
      select l.suggested_cases, l.location_id from sensare_partner_order_suggestion_lines l
      join sensare_partner_order_suggestions s on s.id = l.suggestion_id
      where s.partner_id = ${partner.id} and s.status = 'open'`,
    sql<PartnerOrder[]>`select * from sensare_partner_orders where partner_id = ${partner.id} order by created_at desc`,
    getStockPlan(partner.id, undefined, locations),
    sql<{ units7: number }[]>`select coalesce(sum(units_sold), 0)::int as units7 from sensare_partner_sales
      where partner_id = ${partner.id} and sale_date >= ${addDays(today, -6)}::date`,
    sql<{ location_id: string }[]>`select distinct location_id from sensare_partner_sales where partner_id = ${partner.id} and sale_date = ${today}::date`,
    getConsignmentState(partner),
  ])
  const active = orders.filter(o => o.status !== 'cancelled')
  const open = active.filter(o => o.status !== 'delivered')
  const outstanding = active.reduce((s, o) => s + balance(o), 0)
  const overdue = active.filter(isOverdue)
  const onHand = plan.reduce((s, r) => s + r.on_hand, 0)
  const stockedLocations = new Set(plan.filter(p => p.on_hand > 0).map(p => p.location_id))
  const reportedToday = new Set(todaySales.map(s => s.location_id))
  const missingToday = locations.filter(l => stockedLocations.has(l.id) && !reportedToday.has(l.id))
  const sugCases = sugLines.reduce((s, l) => s + l.suggested_cases, 0)
  const sugBranches = new Set(sugLines.map(l => l.location_id)).size
  const lowLines = plan.filter(p => p.needs_reorder)

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="pp-h1">Welcome back, {partner.contact_name.split(' ')[0]}</h1>
          <p className="pp-muted">Default payment terms: {PAYMENT_TERMS[partner.default_payment_terms]}{locations.length > 1 ? ` · ${locations.length} branches` : ''}</p>
        </div>
        <div className="pp-row">
          <Link href="/partners/portal/sales" className="pp-btn pp-btn-ghost">Record today&apos;s sales</Link>
          <Link href="/partners/portal/order" className="pp-btn">Place an order</Link>
        </div>
      </div>

      {reset && <div className="pp-alert pp-alert-ok" style={{ marginBottom: 0 }}>Your password has been updated.</div>}
      {sugCases > 0 && (
        <div className="pp-card" style={{ borderColor: 'rgba(201,144,106,0.55)' }}>
          <div className="pp-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <p className="pp-h2" style={{ marginBottom: 4 }}>Your suggested reorder is ready</p>
              <p className="pp-muted">{sugCases} case{sugCases === 1 ? '' : 's'}{sugBranches > 1 ? ` across ${sugBranches} branches` : ''}, based on your sales trend, current stock and the 2-week delivery lead time.</p>
            </div>
            <Link href="/partners/portal/suggested" className="pp-btn">Review & approve</Link>
          </div>
        </div>
      )}
      {consignment.isDue && consignment.nextFrom && (
        <div className="pp-alert pp-alert-warn" style={{ marginBottom: 0 }}>
          Consignment settlement is due for sales since {fmtDate(consignment.nextFrom)}. <Link className="pp-link" href="/partners/portal/consignment">Settle now</Link>
        </div>
      )}
      {missingToday.length > 0 && (
        <div className="pp-alert pp-alert-info" style={{ marginBottom: 0 }}>
          No sales recorded today for {missingToday.map(l => l.name).join(', ')}. <Link className="pp-link" href={`/partners/portal/sales?loc=${missingToday[0].id}`}>Record them now</Link> to keep inventory and reorder suggestions accurate.
        </div>
      )}
      {overdue.length > 0 && (
        <div className="pp-alert pp-alert-error" style={{ marginBottom: 0 }}>
          {overdue.length} order{overdue.length > 1 ? 's are' : ' is'} past due ({peso(overdue.reduce((s, o) => s + balance(o), 0))}).{' '}
          <Link className="pp-link" href="/partners/portal/orders">View orders</Link>
        </div>
      )}

      <div className="pp-grid">
        <Stat label="Boxes on hand" value={onHand.toLocaleString()} sub={`${plan.reduce((s, r) => s + r.on_order, 0)} on the way`} />
        <Stat label="Sold last 7 days" value={units7.toLocaleString()} sub="boxes, all branches" />
        <Stat label="Open orders" value={open.length} sub="not yet delivered" />
        <Stat label="Balance due" value={peso(outstanding, 0)} sub={active.some(o => o.payment_terms === 'consignment' && balance(o) > 0) ? 'incl. unsold consignment' : undefined} />
      </div>

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Running low</p>
          {lowLines.length === 0 ? (
            <p className="pp-muted">Your stock looks healthy for the next delivery cycle.</p>
          ) : (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead><tr><th>Product</th><th className="pp-num">On hand</th><th className="pp-num">Days left</th><th>Runs out</th></tr></thead>
                <tbody>
                  {lowLines.map(r => (
                    <tr key={r.location_id + r.product_id}>
                      <td>{r.product_name}{locations.length > 1 && <><br /><span className="pp-muted" style={{ fontSize: 12 }}>{r.location_name}</span></>}</td>
                      <td className="pp-num">{r.on_hand}</td>
                      <td className="pp-num">{r.days_cover === null ? '—' : Math.floor(r.days_cover)}</td>
                      <td>{fmtDate(r.stockout_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pp-card">
          <p className="pp-h2">Recent orders</p>
          {orders.length === 0 ? (
            <p className="pp-muted">No orders yet. <Link href="/partners/portal/order" className="pp-link">Place your first order</Link>.</p>
          ) : (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <tbody>
                  {orders.slice(0, 6).map(o => (
                    <tr key={o.id}>
                      <td><Link className="pp-link" href={`/partners/portal/orders/${o.id}`}>{o.order_number}</Link><br /><span className="pp-muted" style={{ fontSize: 12 }}>{fmtDate(o.created_at)}</span></td>
                      <td><OrderStatusBadge status={o.status} /></td>
                      <td>{o.status !== 'cancelled' && <PaymentStatusBadge status={o.payment_status} overdue={isOverdue(o)} />}</td>
                      <td className="pp-num">{peso(o.total_php, 0)}</td>
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
