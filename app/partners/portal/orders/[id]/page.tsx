import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireApprovedPartnerPage } from '@/lib/auth'
import { db, one } from '@/lib/db'
import { getSetting } from '@/lib/partner-data'
import { balance, fmtDate, isOverdue, locationLabel, manilaToday, peso, PAYMENT_METHOD, PAYMENT_TERMS, PAYMENT_TERMS_HELP, type OrderItem, type PartnerOrder, type Payment } from '@/lib/partner'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/portal/ui'
import { ConfirmButton } from '@/components/portal/forms'
import { cancelOwnOrderAction, confirmReceivedAction } from '../../actions'
import PayPanel from './PayPanel'

export default async function OrderDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string; paid?: string }>
}) {
  const partner = await requireApprovedPartnerPage()
  const { id } = await params
  const sp = await searchParams
  const sql = db()
  const order = /^[0-9a-f-]{36}$/i.test(id)
    ? await one(sql<PartnerOrder[]>`select * from sensare_partner_orders where id = ${id} and partner_id = ${partner.id}`)
    : null
  if (!order) notFound()
  const o = order as PartnerOrder
  const [items, payments, bankDetails, location, siblings] = await Promise.all([
    sql<OrderItem[]>`select * from sensare_partner_order_items where order_id = ${o.id}`,
    sql<Payment[]>`select * from sensare_partner_payments where order_id = ${o.id} order by created_at desc`,
    getSetting('partner_bank_details'),
    one(sql<{ name: string; city: string | null }[]>`select name, city from sensare_partner_locations where id = ${o.location_id}`),
    sql<{ id: string; order_number: string; location_name: string }[]>`
      select o.id, o.order_number, l.name as location_name from sensare_partner_orders o
      join sensare_partner_locations l on l.id = o.location_id
      where o.order_group_id = ${o.order_group_id} and o.id <> ${o.id}`,
  ])
  const due = balance(o)
  const visiblePayments = payments.filter(p => !(p.method === 'hitpay' && p.status !== 'confirmed') && !(p.settlement_id && p.status !== 'confirmed' && p.status !== 'pending'))

  const timeline = [
    { label: 'Submitted', at: o.created_at },
    { label: 'Confirmed', at: o.confirmed_at },
    { label: 'Shipped', at: o.shipped_at },
    { label: 'Delivered', at: o.delivered_at },
  ]

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <p className="pp-muted"><Link href="/partners/portal/orders" className="pp-link">← All orders</Link></p>
          <h1 className="pp-h1">{o.order_number}</h1>
          <div className="pp-row"><OrderStatusBadge status={o.status} />{o.status !== 'cancelled' && <PaymentStatusBadge status={o.payment_status} overdue={isOverdue(o)} />}</div>
        </div>
        <div className="pp-row no-print">
          {o.status === 'shipped' && (
            <form action={confirmReceivedAction}><input type="hidden" name="order_id" value={o.id} />
              <ConfirmButton className="pp-btn" message="Confirm you received this order? The stock will be added to your inventory.">Confirm received</ConfirmButton></form>
          )}
          {o.status === 'submitted' && (
            <form action={cancelOwnOrderAction}><input type="hidden" name="order_id" value={o.id} />
              <ConfirmButton className="pp-btn pp-btn-danger" message="Cancel this order?">Cancel order</ConfirmButton></form>
          )}
        </div>
      </div>

      {sp.placed && <div className="pp-alert pp-alert-ok" style={{ marginBottom: 0 }}>Order placed! We&apos;ll review it and confirm shortly.</div>}
      {sp.paid && <div className="pp-alert pp-alert-ok" style={{ marginBottom: 0 }}>Thanks! Your online payment is being processed — the balance updates as soon as HitPay confirms it.</div>}
      {o.status === 'cancelled' && <div className="pp-alert pp-alert-warn" style={{ marginBottom: 0 }}>This order was cancelled on {fmtDate(o.cancelled_at)}.</div>}

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h3">Items</p>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Product</th><th className="pp-num">Cases</th><th className="pp-num">Boxes</th><th className="pp-num">Case price</th><th className="pp-num">Total</th></tr></thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id}><td>{i.product_name}</td><td className="pp-num">{i.case_qty}</td><td className="pp-num">{i.case_qty * i.case_size}</td><td className="pp-num">{peso(i.case_price_php)}</td><td className="pp-num">{peso(i.line_total_php)}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4}>Subtotal</td><td className="pp-num">{peso(o.subtotal_php)}</td></tr>
                <tr><td colSpan={4}>Shipping {o.status === 'submitted' && <span className="pp-muted">(set on confirmation)</span>}</td><td className="pp-num">{peso(o.shipping_php)}</td></tr>
                <tr><td colSpan={4}>Total</td><td className="pp-num">{peso(o.total_php)}</td></tr>
                <tr><td colSpan={4}>Paid</td><td className="pp-num">{peso(o.amount_paid_php)}</td></tr>
                <tr><td colSpan={4}>Balance</td><td className="pp-num" style={{ color: 'var(--rose-gold)' }}>{peso(due)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="pp-stack">
          <div className="pp-card">
            <p className="pp-h3">Details</p>
            <dl className="pp-dl">
              <dt>Payment terms</dt><dd>{PAYMENT_TERMS[o.payment_terms]}<br /><span className="pp-muted" style={{ fontSize: 13 }}>{PAYMENT_TERMS_HELP[o.payment_terms]}</span></dd>
              <dt>Due date</dt><dd>{o.due_date ? fmtDate(o.due_date) : o.payment_terms === 'consignment' ? 'As units sell' : 'Set on delivery'}</dd>
              <dt>Branch</dt><dd>{location ? locationLabel(location) : '—'}</dd>
              <dt>Deliver to</dt><dd style={{ whiteSpace: 'pre-line' }}>{o.shipping_address || '—'}</dd>
              {siblings.length > 0 && <><dt>Same order</dt><dd>{siblings.map((x, i) => (
                <span key={x.id}>{i > 0 && ', '}<Link className="pp-link" href={`/partners/portal/orders/${x.id}`}>{x.order_number}</Link> ({x.location_name})</span>
              ))}</dd></>}
              {o.tracking_info && <><dt>Tracking</dt><dd>{o.tracking_info}</dd></>}
              {o.partner_notes && <><dt>Your notes</dt><dd>{o.partner_notes}</dd></>}
            </dl>
            <p className="pp-h3" style={{ marginTop: 20 }}>Progress</p>
            <ol style={{ listStyle: 'none' }}>
              {timeline.map(t => (
                <li key={t.label} className="pp-row" style={{ marginBottom: 6, fontSize: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: t.at ? 'var(--rose-gold)' : 'var(--mocha)', border: '1px solid var(--rose-gold-dark)' }} />
                  <span style={{ color: t.at ? 'var(--cream)' : 'var(--text-muted)' }}>{t.label}</span>
                  <span className="pp-muted" style={{ fontSize: 12 }}>{t.at ? fmtDate(t.at) : ''}</span>
                </li>
              ))}
            </ol>
          </div>

          {o.payment_terms === 'consignment' && o.status === 'delivered' && due > 0 && (
            <div className="pp-card no-print">
              <p className="pp-h3">Consignment</p>
              <p className="pp-muted" style={{ marginBottom: 14 }}>You pay for these boxes as they sell. Settle your sales every period from the Consignment page.</p>
              <Link href="/partners/portal/consignment" className="pp-btn pp-btn-sm">Go to consignment settlement</Link>
            </div>
          )}
          {o.status !== 'cancelled' && due > 0 && !(o.payment_terms === 'consignment' && o.status === 'delivered') && (
            <PayPanel orderId={o.id} balance={due} canPayOnline={o.status !== 'submitted'} bankDetails={bankDetails} today={manilaToday()} />
          )}
        </div>
      </div>

      {visiblePayments.length > 0 && (
        <div className="pp-card">
          <p className="pp-h3">Payments</p>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Status</th><th className="pp-num">Amount</th></tr></thead>
              <tbody>
                {visiblePayments.map(p => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.paid_on || p.created_at)}</td><td>{PAYMENT_METHOD[p.method]}{p.settlement_id && <><br /><span className="pp-muted" style={{ fontSize: 12 }}>Consignment settlement</span></>}</td><td>{p.reference || '—'}</td>
                    <td><span className={`pp-badge ${p.status === 'confirmed' ? 'pp-badge-ok' : p.status === 'pending' ? 'pp-badge-warn' : 'pp-badge-bad'}`}>{p.status === 'pending' ? 'Verifying' : p.status}</span></td>
                    <td className="pp-num">{peso(p.amount_php)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
