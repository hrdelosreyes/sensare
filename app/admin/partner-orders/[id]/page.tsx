import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { balance, fmtDate, isOverdue, manilaToday, peso, PAYMENT_METHOD, PAYMENT_TERMS, type OrderItem, type Partner, type PartnerOrder, type Payment } from '@/lib/partner'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/portal/ui'
import { ConfirmButton } from '@/components/portal/forms'
import PrintButton from '@/components/portal/PrintButton'
import { reviewPaymentAction } from '../../actions'
import { TransitionPanel, EditOrderForm, RecordPaymentForm } from './forms'

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const db = supabaseAdmin()
  const { data } = await db.from('sensare_partner_orders').select('*, sensare_partners(*)').eq('id', id).maybeSingle()
  if (!data) notFound()
  const order = data as PartnerOrder & { sensare_partners: Partner }
  const partner = order.sensare_partners
  const [{ data: items }, { data: payments }, { data: products }] = await Promise.all([
    db.from('sensare_partner_order_items').select('*').eq('order_id', id),
    db.from('sensare_partner_payments').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    db.from('sensare_products').select('id, stock_qty'),
  ])
  const stockBy = new Map((products ?? []).map(p => [p.id as string, Number(p.stock_qty)]))
  const its = (items ?? []) as OrderItem[]
  const pays = (payments ?? []) as Payment[]
  const due = balance(order)

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <p className="pp-muted no-print"><Link href="/admin/partner-orders" className="pp-link">← Partner orders</Link></p>
          <h1 className="pp-h1">{order.order_number}</h1>
          <p className="pp-text" style={{ marginBottom: 8 }}><Link className="pp-link" href={`/admin/partners/${partner.id}`}>{partner.business_name}</Link> · {partner.contact_name} · {partner.phone}</p>
          <div className="pp-row"><OrderStatusBadge status={order.status} />{order.status !== 'cancelled' && <PaymentStatusBadge status={order.payment_status} overdue={isOverdue(order)} />}<span className="pp-muted">Placed {fmtDate(order.created_at)}</span></div>
        </div>
        <PrintButton label="Print packing slip" />
      </div>

      {order.status !== 'cancelled' && order.status !== 'delivered' && <TransitionPanel order={order} />}

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h3">Items</p>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Product</th><th className="pp-num">Cases</th><th className="pp-num">Boxes</th>{order.status === 'submitted' && <th className="pp-num no-print">Warehouse</th>}<th className="pp-num">Case price</th><th className="pp-num">Total</th></tr></thead>
              <tbody>
                {its.map(i => {
                  const units = i.case_qty * i.case_size
                  const wh = stockBy.get(i.product_id) ?? 0
                  return (
                    <tr key={i.id}>
                      <td>{i.product_name}</td><td className="pp-num">{i.case_qty}</td><td className="pp-num">{units}</td>
                      {order.status === 'submitted' && <td className="pp-num no-print" style={{ color: wh < units ? '#e09a9a' : undefined }}>{wh}</td>}
                      <td className="pp-num">{peso(i.case_price_php)}</td><td className="pp-num">{peso(i.line_total_php)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Subtotal</td><td className="pp-num">{peso(order.subtotal_php)}</td></tr>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Shipping</td><td className="pp-num">{peso(order.shipping_php)}</td></tr>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Total</td><td className="pp-num">{peso(order.total_php)}</td></tr>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Paid</td><td className="pp-num">{peso(order.amount_paid_php)}</td></tr>
                <tr><td colSpan={order.status === 'submitted' ? 5 : 4}>Balance</td><td className="pp-num" style={{ color: 'var(--rose-gold)' }}>{peso(due)}</td></tr>
              </tfoot>
            </table>
          </div>
          <dl className="pp-dl" style={{ marginTop: 20 }}>
            <dt>Deliver to</dt><dd>{order.shipping_address || '—'}</dd>
            <dt>Partner notes</dt><dd>{order.partner_notes || '—'}</dd>
            <dt>Terms</dt><dd>{PAYMENT_TERMS[order.payment_terms]}{order.payment_terms !== partner.default_payment_terms && <span className="pp-badge pp-badge-warn" style={{ marginLeft: 8 }}>Differs from default ({PAYMENT_TERMS[partner.default_payment_terms]})</span>}</dd>
            <dt>Due date</dt><dd>{fmtDate(order.due_date)}</dd>
            <dt>Timeline</dt><dd>Confirmed {fmtDate(order.confirmed_at)} · Shipped {fmtDate(order.shipped_at)} · Delivered {fmtDate(order.delivered_at)}{order.cancelled_at && ` · Cancelled ${fmtDate(order.cancelled_at)}`}</dd>
          </dl>
        </div>

        <div className="pp-stack no-print">
          {order.status !== 'cancelled' && (
            <div className="pp-card">
              <p className="pp-h3">Order settings</p>
              <EditOrderForm order={order} />
            </div>
          )}
          {order.status !== 'cancelled' && due > 0 && (
            <div className="pp-card">
              <p className="pp-h3">Record a payment</p>
              <RecordPaymentForm orderId={order.id} balance={due} today={manilaToday()} />
            </div>
          )}
        </div>
      </div>

      <div className="pp-card no-print">
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
                      {p.status === 'pending' && p.method !== 'hitpay' && (
                        <div className="pp-row" style={{ gap: 6 }}>
                          <form action={reviewPaymentAction}><input type="hidden" name="payment_id" value={p.id} /><input type="hidden" name="decision" value="confirmed" />
                            <ConfirmButton message={`Confirm ${peso(p.amount_php)} was received?`}>Confirm</ConfirmButton></form>
                          <form action={reviewPaymentAction}><input type="hidden" name="payment_id" value={p.id} /><input type="hidden" name="decision" value="rejected" />
                            <ConfirmButton className="pp-btn pp-btn-sm pp-btn-danger" message="Reject this payment report?">Reject</ConfirmButton></form>
                        </div>
                      )}
                      {p.status === 'pending' && p.method === 'hitpay' && <span className="pp-muted" style={{ fontSize: 12 }}>Awaiting HitPay</span>}
                    </td>
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
