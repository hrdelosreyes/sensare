import Link from 'next/link'
import { requireApprovedPartnerPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { balance, fmtDate, isOverdue, peso, PAYMENT_TERMS, type PartnerOrder } from '@/lib/partner'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/portal/ui'

export default async function OrdersPage() {
  const partner = await requireApprovedPartnerPage()
  const { data } = await supabaseAdmin().from('sensare_partner_orders').select('*')
    .eq('partner_id', partner.id).order('created_at', { ascending: false })
  const orders = (data ?? []) as PartnerOrder[]

  return (
    <div>
      <div className="pp-head">
        <h1 className="pp-h1">Orders</h1>
        <Link href="/partners/portal/order" className="pp-btn">New order</Link>
      </div>
      <div className="pp-card">
        {orders.length === 0 ? <p className="pp-empty">No orders yet.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Terms</th><th>Payment</th><th>Due</th><th className="pp-num">Total</th><th className="pp-num">Balance</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td><Link className="pp-link" href={`/partners/portal/orders/${o.id}`}>{o.order_number}</Link></td>
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
