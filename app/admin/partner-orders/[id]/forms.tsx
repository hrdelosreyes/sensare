'use client'
import { useActionState } from 'react'
import { orderTransitionAction, updateOrderAction, recordPaymentAction } from '../../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'
import { PAYMENT_METHOD, PAYMENT_TERMS, type PartnerOrder, type PaymentTerms } from '@/lib/partner'

export function TransitionPanel({ order }: { order: PartnerOrder }) {
  const [state, action] = useActionState(orderTransitionAction, undefined)
  const s = order.status
  return (
    <ActionForm action={action} className="pp-card no-print" beforeSubmit={submitter => {
      const to = submitter?.getAttribute('value')
      if (to === 'cancelled') return confirm('Cancel this order? Any deducted warehouse stock will be returned.')
      if (to === 'delivered') return confirm('Mark as delivered? The boxes will be added to the partner’s inventory.')
      return true
    }}>
      <input type="hidden" name="order_id" value={order.id} />
      <FormMessage state={state} />
      <p className="pp-h3">Next step</p>
      {s === 'submitted' && <p className="pp-muted" style={{ marginBottom: 12 }}>Check the payment terms and shipping fee below first. Confirming deducts the boxes from warehouse stock.</p>}
      {s === 'confirmed' && (
        <label className="pp-field" style={{ maxWidth: 420 }}><span className="pp-label">Courier / tracking (optional)</span>
          <input className="pp-input" name="tracking_info" defaultValue={order.tracking_info ?? ''} maxLength={300} placeholder="e.g. LBC 1234567890" /></label>
      )}
      <div className="pp-row">
        {s === 'submitted' && <SubmitButton name="to" value="confirmed" pendingText="…">Confirm order</SubmitButton>}
        {s === 'confirmed' && <SubmitButton name="to" value="shipped" pendingText="…">Mark shipped</SubmitButton>}
        {(s === 'confirmed' || s === 'shipped') && <SubmitButton name="to" value="delivered" className={s === 'shipped' ? 'pp-btn' : 'pp-btn pp-btn-ghost'} pendingText="…">Mark delivered</SubmitButton>}
        <SubmitButton name="to" value="cancelled" className="pp-btn pp-btn-danger" pendingText="…">Cancel order</SubmitButton>
      </div>
      {s === 'shipped' && <p className="pp-hint" style={{ marginTop: 10 }}>The partner can also confirm receipt from their portal.</p>}
    </ActionForm>
  )
}

export function EditOrderForm({ order }: { order: PartnerOrder }) {
  const [state, action] = useActionState(updateOrderAction, undefined)
  return (
    <ActionForm action={action}>
      <input type="hidden" name="order_id" value={order.id} />
      <FormMessage state={state} />
      <div className="pp-grid-2" style={{ gap: '0 16px' }}>
        <label className="pp-field"><span className="pp-label">Payment terms</span>
          <select className="pp-select" name="payment_terms" defaultValue={order.payment_terms}>
            {(Object.keys(PAYMENT_TERMS) as PaymentTerms[]).map(t => <option key={t} value={t}>{PAYMENT_TERMS[t]}</option>)}
          </select></label>
        <label className="pp-field"><span className="pp-label">Shipping fee (₱)</span>
          <input className="pp-input" name="shipping_php" type="number" step="0.01" min="0" defaultValue={Number(order.shipping_php)} /></label>
      </div>
      {order.status === 'delivered' && (
        <label className="pp-field"><span className="pp-label">Due date override</span>
          <input className="pp-input" name="due_date" type="date" defaultValue={order.due_date ?? ''} />
          <span className="pp-hint">Changing terms recalculates the due date automatically unless you set one here.</span></label>
      )}
      <label className="pp-field"><span className="pp-label">Courier / tracking</span>
        <input className="pp-input" name="tracking_info" defaultValue={order.tracking_info ?? ''} maxLength={300} /></label>
      <label className="pp-field"><span className="pp-label">Internal notes</span>
        <textarea className="pp-textarea" name="admin_notes" defaultValue={order.admin_notes ?? ''} maxLength={2000} style={{ minHeight: 60 }} /></label>
      <SubmitButton className="pp-btn pp-btn-sm">Save changes</SubmitButton>
    </ActionForm>
  )
}

export function RecordPaymentForm({ orderId, balance, today, collector = false }: { orderId: string; balance: number; today: string; collector?: boolean }) {
  const [state, action] = useActionState(recordPaymentAction, undefined)
  return (
    <ActionForm action={action}>
      <input type="hidden" name="order_id" value={orderId} />
      <FormMessage state={state} />
      <div className="pp-grid-2" style={{ gap: '0 16px' }}>
        <label className="pp-field"><span className="pp-label">Amount (₱)</span>
          <input className="pp-input" name="amount" type="number" step="0.01" min="0.01" defaultValue={balance.toFixed(2)} required /></label>
        <label className="pp-field"><span className="pp-label">Method</span>
          <select className="pp-select" name="method" defaultValue="cash">
            {Object.entries(PAYMENT_METHOD).filter(([k]) => k !== 'hitpay' && !(collector && k === 'return_credit')).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
        <label className="pp-field"><span className="pp-label">Date received</span>
          <input className="pp-input" name="paid_on" type="date" defaultValue={today} max={today} /></label>
        <label className="pp-field"><span className="pp-label">Reference</span>
          <input className="pp-input" name="reference" maxLength={100} /></label>
      </div>
      <label className="pp-field"><span className="pp-label">Notes</span>
        <input className="pp-input" name="notes" maxLength={500} placeholder="e.g. consignment settlement for October sales" /></label>
      {!collector && <label className="pp-row pp-muted" style={{ gap: 6, marginBottom: 14 }}><input type="checkbox" name="notify" defaultChecked /> Email a receipt to the partner</label>}
      <SubmitButton className="pp-btn pp-btn-sm">{collector ? 'Log collection' : 'Record payment'}</SubmitButton>
      <p className="pp-hint" style={{ marginTop: 8 }}>{collector
        ? 'Finance confirms it once the money arrives; it then reduces the balance and counts toward your commission.'
        : 'For consignment, record each settlement as units sell. Use “Return credit” when unsold stock comes back.'}</p>
    </ActionForm>
  )
}
