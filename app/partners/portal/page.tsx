import Link from 'next/link'
import { requireApprovedPartnerPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getLowStockDays, getPartnerStock } from '@/lib/partner-data'
import { addDays, balance, fmtDate, isOverdue, manilaToday, peso, PAYMENT_TERMS, type PartnerOrder } from '@/lib/partner'
import { OrderStatusBadge, PaymentStatusBadge, Stat } from '@/components/portal/ui'

export default async function PortalDashboard() {
  const partner = await requireApprovedPartnerPage()
  const db = supabaseAdmin()
  const today = manilaToday()
  const lowDays = await getLowStockDays()

  const [{ data: ordersData }, stock, { data: sales7 }, { data: todaySales }] = await Promise.all([
    db.from('sensare_partner_orders').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }),
    getPartnerStock(partner.id, lowDays),
    db.from('sensare_partner_sales').select('units_sold, unit_price_php').eq('partner_id', partner.id).gte('sale_date', addDays(today, -6)),
    db.from('sensare_partner_sales').select('id').eq('partner_id', partner.id).eq('sale_date', today).limit(1),
  ])
  const orders = (ordersData ?? []) as PartnerOrder[]
  const active = orders.filter(o => o.status !== 'cancelled')
  const open = active.filter(o => o.status !== 'delivered')
  const outstanding = active.reduce((s, o) => s + balance(o), 0)
  const overdue = active.filter(isOverdue)
  const onHand = stock.reduce((s, r) => s + r.on_hand, 0)
  const units7 = (sales7 ?? []).reduce((s, r) => s + Number(r.units_sold), 0)
  const reorder = stock.filter(r => r.suggested_cases > 0 || (r.on_hand === 0 && r.sold_last_14 > 0))
  const consignmentOpen = active.filter(o => o.payment_terms === 'consignment' && balance(o) > 0)

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="pp-h1">Welcome back, {partner.contact_name.split(' ')[0]}</h1>
          <p className="pp-muted">Default payment terms: {PAYMENT_TERMS[partner.default_payment_terms]}</p>
        </div>
        <div className="pp-row">
          <Link href="/partners/portal/sales" className="pp-btn pp-btn-ghost">Record today&apos;s sales</Link>
          <Link href="/partners/portal/order" className="pp-btn">Place an order</Link>
        </div>
      </div>

      {!todaySales?.length && onHand > 0 && (
        <div className="pp-alert pp-alert-info" style={{ marginBottom: 0 }}>
          You haven&apos;t recorded sales for today yet. <Link className="pp-link" href="/partners/portal/sales">Record them now</Link> to keep your inventory accurate.
        </div>
      )}
      {overdue.length > 0 && (
        <div className="pp-alert pp-alert-error" style={{ marginBottom: 0 }}>
          {overdue.length} order{overdue.length > 1 ? 's are' : ' is'} past due ({peso(overdue.reduce((s, o) => s + balance(o), 0))}).{' '}
          <Link className="pp-link" href="/partners/portal/orders">View orders</Link>
        </div>
      )}

      <div className="pp-grid">
        <Stat label="Units on hand" value={onHand.toLocaleString()} sub={`${stock.length} product${stock.length === 1 ? '' : 's'}`} />
        <Stat label="Sold last 7 days" value={units7.toLocaleString()} sub="units" />
        <Stat label="Open orders" value={open.length} sub="not yet delivered" />
        <Stat label="Balance due" value={peso(outstanding, 0)} sub={consignmentOpen.length ? `incl. ${consignmentOpen.length} consignment` : undefined} />
      </div>

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Reorder suggestions</p>
          {reorder.length === 0 ? (
            <p className="pp-muted">Your stock looks healthy. We&apos;ll suggest a reorder when any product drops below {lowDays} days of cover, based on your last 14 days of sales.</p>
          ) : (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead><tr><th>Product</th><th className="pp-num">On hand</th><th className="pp-num">Days left</th><th className="pp-num">Suggest</th></tr></thead>
                <tbody>
                  {reorder.map(r => (
                    <tr key={r.product_id}>
                      <td>{r.product_name}</td>
                      <td className="pp-num">{r.on_hand}</td>
                      <td className="pp-num">{r.days_cover === null ? '—' : r.days_cover.toFixed(1)}</td>
                      <td className="pp-num">{Math.max(1, r.suggested_cases)} case{r.suggested_cases > 1 ? 's' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link href="/partners/portal/order" className="pp-btn pp-btn-sm" style={{ marginTop: 14 }}>Order now</Link>
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
                  {orders.slice(0, 5).map(o => (
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
