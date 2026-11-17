'use client'
import { useActionState } from 'react'
import { recordSettlementAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'
import { peso } from '@/lib/partner'

export default function RecordSettlementForm({ partnerId, to, amount, today, collector = false }: { partnerId: string; to: string; amount: number; today: string; collector?: boolean }) {
  const [state, action] = useActionState(recordSettlementAction, undefined)
  return (
    <ActionForm action={action} style={{ marginTop: 20, maxWidth: 640 }}>
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="period_to" value={to} />
      <FormMessage state={state} />
      <div className="pp-grid-2" style={{ gap: '0 16px' }}>
        <label className="pp-field"><span className="pp-label">Method</span>
          <select className="pp-select" name="method" defaultValue="cash">
            <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="check">Check</option><option value="other">Other</option>
          </select></label>
        <label className="pp-field"><span className="pp-label">Date received</span>
          <input className="pp-input" name="paid_on" type="date" defaultValue={today} max={today} /></label>
        <label className="pp-field"><span className="pp-label">Reference</span><input className="pp-input" name="reference" maxLength={100} /></label>
        <label className="pp-field"><span className="pp-label">Notes</span><input className="pp-input" name="notes" maxLength={500} /></label>
      </div>
      {!collector && <label className="pp-row pp-muted" style={{ gap: 6, marginBottom: 14 }}><input type="checkbox" name="notify" defaultChecked /> Email a receipt to the partner</label>}
      <SubmitButton>{collector ? `Log ${peso(amount, 0)} collected` : `Record ${peso(amount, 0)} received`}</SubmitButton>
      {collector && <p className="pp-hint" style={{ marginTop: 8 }}>Finance confirms it once the money arrives.</p>}
    </ActionForm>
  )
}
