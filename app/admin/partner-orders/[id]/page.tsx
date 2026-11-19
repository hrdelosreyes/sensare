import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'
import { db, one } from '@/lib/db'
import { balance, fmtDate, isOverdue, manilaToday, peso, PAYMENT_METHOD, PAYMENT_TERMS, type OrderItem, type Partner, type PartnerOrder, type Payment } from '@/lib/partner'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/portal/ui'
import { ConfirmButton } from '@/components/portal/forms'
import PrintButton from '@/components/portal/PrintButton'
import { reviewPaymentAction } from '../../actions'
import { TransitionPanel, EditOrderForm, RecordPaymentForm } from './forms'
import { can } from '@/lib/roles'

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage('orders.view')
  const may = (p: Parameters<typeof can>[1]) => can(admin.role, p)
  const money = may('money.view')
  const { id } = await params
  const sql = db()
  const data = /^[0-9a-f-]{36}$/i.test(id) ? await one(sql<PartnerOrder[]>`select o.* from sensare_partner_orders o join sensare_partners p on p.id = o.partner_id
    where o.id = ${id} ${admin.role === 'account_manager' ? sql`and p.account_manager_id = ${admin.user_id}` : sql``}`) : null
  if (!data) notFound()
  const order = data
  const [partner, its, pays, products, location, siblings] = await Promise.all([
    one(sql<Partner[]>`select * from sensare_partners where id = ${order.partner_id}`).then(p => p!),
    sql<OrderItem[]>`select * from sensare_partner_order_items where order_id = ${id}`,
    sql<Payment[]>`select * from sensare_partner_payments where order_id = ${id} order by created_at desc`,
    sql<{ id: string; stock_qty: number }[]>`select id, stock_qty from sensare_products`,
    one(sql<{ name: string }[]>`select name from sensare_partner_locations where id = ${order.location_id}`),
    sql<{ id: string; order_number: string; location_name: string }[]>`
      select o.id, o.order_number, l.name as location_name from sensare_partner_orders o
      join sensare_partner_locations l on l.id = o.location_id
      where o.order_group_id = ${order.order_group_id} and o.id <> ${order.id}`,
  ])
  const stockBy = new Map(products.map(p => [p.id, p.stock_qty]))
  const due = balance(order)

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <p className="pp-muted no-print"><Link href="/admin/partner-orders" className="pp-link">← Partner orders</Link></p>
          <h1 className="pp-h1">{order.order_number}</h1>
          <p className="pp-text" style={{ marginBottom: 8 }}>{may('partners.view') ? <Link className="pp-link" href={`/admin/partners/${partner.id}`}>{partner.business_name}</Link> : partner.business_name} · {partner.contact_name} · {partner.phone}</p>
          <div className="pp-row"><OrderStatusBadge status={order.status} />{order.status !== 'cancelled' && <PaymentStatusBadge status={order.payment_status} overdue={isOverdue(order)} />}<span className="pp-muted">Placed {fmtDate(order.created_at)}</span></div>
        </div>
        <PrintButton label="Print packing slip" />
      </div>

      {may('orders.fulfill') && order.status !== 'cancelled' && order.status !== 'delivered' && <TransitionPanel order={order} />}

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h3">Items</p>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Product</th><th className="pp-num">Cases</th><th className="pp-num">Boxes</th>{order.status === 'submitted' && <th className="pp-num no-print">Warehouse</th>}{money && <><th className="pp-num">Case price</th><th className="pp-num">Total</th></>}</tr></thead>
              <tbody>
                {its.map(i => {
                  const units = i.case_qty * i.case_size
                  const wh = stockBy.get(i.product_id) ?? 0
                  return (
                    <tr key={i.id}>
                      <td>{i.product_name}</td><td className="pp-num">{i.case_qty}</td><td className="pp-num">{units}</td>
                      {order.status === 'submitted' && <td className="pp-num no-print" style={{ color: wh < units ? '#e09a9a' : undefined }}>{wh}</td>}
                      {money && <><td className="pp-num">{peso(i.case_price_php)}</td><td className="pp-num">{peso(i.line_total_php)}</td></>}
                    </tr>
                  )
                })}
              </tbody>
              {money && <tfoot>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Subtotal</td><td className="pp-num">{peso(order.subtotal_php)}</td></tr>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Shipping</td><td className="pp-num">{peso(order.shipping_php)}</td></tr>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Total</td><td className="pp-num">{peso(order.total_php)}</td></tr>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Paid</td><td className="pp-num">{peso(order.amount_paid_php)}</td></tr>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Balance</td><td className="pp-num" style={{ color: 'var(--rose-gold)' }}>{peso(due)}</td></tr>
              </tfoot>}
            </table>
          </div>
          <dl className="pp-dl" style={{ marginTop: 20 }}>
            <dt>Branch</dt><dd>{location?.name ?? '—'}</dd>
            <dt>Deliver to</dt><dd style={{ whiteSpace: 'pre-line' }}>{order.shipping_address || '—'}</dd>
            {siblings.length > 0 && <><dt>Same request</dt><dd>{siblings.map((x, i) => (
              <span key={x.id}>{i > 0 && ', '}<Link className="pp-link" href={`/admin/partner-orders/${x.id}`}>{x.order_number}</Link> ({x.location_name})</span>
            ))}</dd></>}
            {order.suggestion_id && <><dt>Source</dt><dd>Approved from an automatic suggestion</dd></>}
            <dt>Partner notes</dt><dd>{order.partner_notes || '—'}</dd>
            <dt>Terms</dt><dd>{PAYMENT_TERMS[order.payment_terms]}{order.payment_terms !== partner.default_payment_terms && <span className="pp-badge pp-badge-warn" style={{ marginLeft: 8 }}>Differs from default ({PAYMENT_TERMS[partner.default_payment_terms]})</span>}</dd>
            <dt>Due date</dt><dd>{fmtDate(order.due_date)}</dd>
            <dt>Timeline</dt><dd>Confirmed {fmtDate(order.confirmed_at)} · Shipped {fmtDate(order.shipped_at)} · Delivered {fmtDate(order.delivered_at)}{order.cancelled_at && ` · Cancelled ${fmtDate(order.cancelled_at)}`}</dd>
          </dl>
        </div>

        <div className="pp-stack no-print">
          {may('orders.edit') && order.status !== 'cancelled' && (
            <div className="pp-card">
              <p className="pp-h3">Order settings</p>
              <EditOrderForm order={order} />
            </div>
          )}
          {(may('payments.record') || may('payments.collect')) && order.status !== 'cancelled' && due > 0 && (
            <div className="pp-card">
              <p className="pp-h3">{may('payments.record') ? 'Record a payment' : 'Log a collection'}</p>
              <RecordPaymentForm orderId={order.id} balance={due} today={manilaToday()} collector={!may('payments.record')} />
            </div>
          )}
        </div>
      </div>

      {money && <div className="pp-card no-print">
        <p className="pp-h3">Payments</p>
        {pays.length === 0 ? <p className="pp-empty">No payments yet.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Notes</th><th>Status</th><th className="pp-num">Amount</th><th></th></tr></thead>
              <tbody>
                {pays.map(p => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.paid_on || p.created_at)}</td><td>{PAYMENT_METHOD[p.method]}</td><td>{p.reference || '—'}</td><td>{p.notes || ''}</td>
                    <td><span className={`pp-badge ${p.status === 'confirmed' ? 'pp-badge-ok' : p.status === 'pending' ? 'pp-badge-warn' : 'pp-badge-bad'}`}>{p.status}</span></td>
                    <td className="pp-num">{peso(p.amount_php)}</td>
                    <td>
                      {p.settlement_id && <Link className="pp-link" style={{ fontSize: 12 }} href="/admin/consignment">Consignment settlement</Link>}
                      {may('payments.review') && p.status === 'pending' && p.method !== 'hitpay' && !p.settlement_id && (
                        <div className="pp-row" style={{ gap: 6 }}>
                          <form action={reviewPaymentAction}><input type="hidden" name="payment_id" value={p.id} /><input type="hidden" name="decision" value="confirmed" />
                            <ConfirmButton message={`Confirm ${peso(p.amount_php)} was received?`}>Confirm</ConfirmButton></form>
                          <form action={reviewPaymentAction}><input type="hidden" name="payment_id" value={p.id} /><input type="hidden" name="decision" value="rejected" />
                            <ConfirmButton className="pp-btn pp-btn-sm pp-btn-danger" message="Reject this payment report?">Reject</ConfirmButton></form>
                        </div>
                      )}
                      {p.status === 'pending' && p.method === 'hitpay' && !p.settlement_id && <span className="pp-muted" style={{ fontSize: 12 }}>Awaiting HitPay</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
    </div>
  )
}
