import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { balance, fmtDate, isOverdue, peso, PAYMENT_TERMS, type OrderStatus, type PartnerOrder } from '@/lib/partner'
import { OrderStatusBadge, PaymentStatusBadge, Stat } from '@/components/portal/ui'

const FILTERS: { key: string; label: string }[] = [
  { key: 'open', label: 'Open' }, { key: 'submitted', label: 'To confirm' }, { key: 'confirmed', label: 'To ship' },
  { key: 'shipped', label: 'In transit' }, { key: 'unpaid', label: 'Unpaid' }, { key: 'overdue', label: 'Overdue' },
  { key: 'delivered', label: 'Delivered' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'all', label: 'All' },
]

type Row = PartnerOrder & { business_name: string; location_name: string; pending_transfer: boolean }

export default async function AdminPartnerOrdersPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireAdminPage()
  const f = (await searchParams).f ?? 'open'
  const orders = await db()<Row[]>`
    select o.*, p.business_name, l.name as location_name,
      exists (select 1 from sensare_partner_payments x
              where x.order_id = o.id and x.status = 'pending' and x.settlement_id is null and x.method <> 'hitpay') as pending_transfer
    from sensare_partner_orders o
    join sensare_partners p on p.id = o.partner_id
    join sensare_partner_locations l on l.id = o.location_id
    order by o.created_at desc limit 1000`

  const match = (o: Row) => {
    switch (f) {
      case 'open': return !['delivered', 'cancelled'].includes(o.status)
      case 'unpaid': return o.status !== 'cancelled' && o.payment_status !== 'paid'
      case 'overdue': return isOverdue(o)
      case 'all': return true
      default: return o.status === (f as OrderStatus)
    }
  }
  const shown = orders.filter(match)
  const active = orders.filter(o => o.status !== 'cancelled')
  const toVerify = orders.filter(o => o.pending_transfer && o.status !== 'cancelled')

  return (
    <div className="pp-stack">
      <h1 className="pp-h1">Partner orders</h1>
      <div className="pp-grid">
        <Stat label="To confirm" value={orders.filter(o => o.status === 'submitted').length} />
        <Stat label="To ship" value={orders.filter(o => o.status === 'confirmed').length} />
        <Stat label="Outstanding" value={peso(active.reduce((s, o) => s + balance(o), 0), 0)} />
        <Stat label="Overdue" value={peso(active.filter(isOverdue).reduce((s, o) => s + balance(o), 0), 0)} />
      </div>
      {toVerify.length > 0 && (
        <div className="pp-alert pp-alert-warn" style={{ marginBottom: 0 }}>
          {toVerify.length} order{toVerify.length > 1 ? 's have' : ' has'} a reported bank transfer to verify:{' '}
          {toVerify.slice(0, 8).map((o, i) => <span key={o.id}>{i > 0 && ', '}<Link className="pp-link" href={`/admin/partner-orders/${o.id}`}>{o.order_number}</Link></span>)}
        </div>
      )}
      <div className="pp-row">
        {FILTERS.map(x => <Link key={x.key} href={`/admin/partner-orders?f=${x.key}`} className={`pp-btn pp-btn-sm ${f === x.key ? '' : 'pp-btn-ghost'}`}>{x.label}</Link>)}
      </div>
      <div className="pp-card">
        {shown.length === 0 ? <p className="pp-empty">No orders here.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Order</th><th>Partner / branch</th><th>Date</th><th>Status</th><th>Terms</th><th>Payment</th><th>Due</th><th className="pp-num">Total</th><th className="pp-num">Balance</th></tr></thead>
              <tbody>
                {shown.map(o => (
                  <tr key={o.id}>
                    <td><Link className="pp-link" href={`/admin/partner-orders/${o.id}`}>{o.order_number}</Link></td>
                    <td>{o.business_name}<br /><span className="pp-muted" style={{ fontSize: 12 }}>{o.location_name}</span></td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td><OrderStatusBadge status={o.status} /></td>
                    <td>{PAYMENT_TERMS[o.payment_terms]}</td>
                    <td>{o.status !== 'cancelled' && <PaymentStatusBadge status={o.payment_status} overdue={isOverdue(o)} />}</td>
                    <td>{fmtDate(o.due_date)}</td>
                    <td className="pp-num">{peso(o.total_php, 0)}</td>
                    <td className="pp-num">{o.status === 'cancelled' ? '—' : peso(balance(o), 0)}</td>
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
