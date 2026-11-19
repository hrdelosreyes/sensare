import Link from 'next/link'
import { requireApprovedPartnerPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { balance, fmtDate, isOverdue, locationLabel, peso, PAYMENT_TERMS, type PartnerOrder } from '@/lib/partner'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/portal/ui'

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ placed?: string }> }) {
  const partner = await requireApprovedPartnerPage()
  const { placed } = await searchParams
  const orders = await db()<(PartnerOrder & { location_name: string; location_city: string | null })[]>`
    select o.*, l.name as location_name, l.city as location_city
    from sensare_partner_orders o join sensare_partner_locations l on l.id = o.location_id
    where o.partner_id = ${partner.id} order by o.created_at desc`
  const groupSize = new Map<string, number>()
  for (const o of orders) groupSize.set(o.order_group_id, (groupSize.get(o.order_group_id) ?? 0) + 1)
  const placedCount = placed ? groupSize.get(placed) ?? 0 : 0

  return (
    <div>
      <div className="pp-head">
        <h1 className="pp-h1">Orders</h1>
        <Link href="/partners/portal/order" className="pp-btn">New order</Link>
      </div>
      {placedCount > 0 && <div className="pp-alert pp-alert-ok">Order placed and split into {placedCount} deliveries (highlighted below). We&apos;ll review and confirm them shortly.</div>}
      <div className="pp-card">
        {orders.length === 0 ? <p className="pp-empty">No orders yet.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Order</th><th>Branch</th><th>Date</th><th>Status</th><th>Terms</th><th>Payment</th><th>Due</th><th className="pp-num">Total</th><th className="pp-num">Balance</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={placed && o.order_group_id === placed ? { background: 'rgba(164,82,63,0.08)' } : undefined}>
                    <td><Link className="pp-link" href={`/partners/portal/orders/${o.id}`}>{o.order_number}</Link>
                      {(groupSize.get(o.order_group_id) ?? 1) > 1 && <><br /><span className="pp-muted" style={{ fontSize: 11 }}>split order</span></>}</td>
                    <td>{locationLabel({ name: o.location_name, city: o.location_city })}</td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td><OrderStatusBadge status={o.status} /></td>
                    <td>{PAYMENT_TERMS[o.payment_terms]}</td>
                    <td>{o.status !== 'cancelled' && <PaymentStatusBadge status={o.payment_status} overdue={isOverdue(o)} />}</td>
                    <td>{fmtDate(o.due_date)}</td>
                    <td className="pp-num">{peso(o.total_php)}</td>
                    <td className="pp-num">{o.status === 'cancelled' ? '—' : peso(balance(o))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
