'use client'
import { useActionState, useState, useTransition } from 'react'
import { payOnlineAction, reportBankTransferAction } from '../../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { peso } from '@/lib/partner'

export default function PayPanel({ orderId, balance, canPayOnline, bankDetails, today }: {
  orderId: string; balance: number; canPayOnline: boolean; bankDetails: string; today: string
}) {
  const [tab, setTab] = useState<'online' | 'bank'>('online')
  const [onlineError, setOnlineError] = useState('')
  const [pending, start] = useTransition()
  const [state, action] = useActionState(reportBankTransferAction, undefined)

  function payOnline() {
    setOnlineError('')
    start(async () => {
      const res = await payOnlineAction(orderId)
      if (res.url) window.location.href = res.url
      else setOnlineError(res.error || 'Something went wrong.')
    })
  }

  return (
    <div className="pp-card no-print">
      <p className="pp-h3">Pay {peso(balance)}</p>
      <div className="pp-row" style={{ marginBottom: 16 }}>
        <button type="button" className={`pp-btn pp-btn-sm ${tab === 'online' ? '' : 'pp-btn-ghost'}`} onClick={() => setTab('online')}>Pay online</button>
        <button type="button" className={`pp-btn pp-btn-sm ${tab === 'bank' ? '' : 'pp-btn-ghost'}`} onClick={() => setTab('bank')}>Bank transfer</button>
      </div>

      {tab === 'online' ? (
        <div>
          <p className="pp-muted" style={{ marginBottom: 14 }}>Pay securely by card, GCash, Maya or online banking via HitPay.</p>
          {onlineError && <div className="pp-alert pp-alert-error">{onlineError}</div>}
          {canPayOnline
            ? <button type="button" className="pp-btn" onClick={payOnline} disabled={pending}>{pending ? 'Redirecting…' : `Pay ${peso(balance, 0)} now`}</button>
            : <p className="pp-alert pp-alert-info" style={{ marginBottom: 0 }}>Online payment opens once we confirm your order and final total.</p>}
        </div>
      ) : (
        <form action={action}>
          <input type="hidden" name="order_id" value={orderId} />
          <div className="pp-alert pp-alert-info" style={{ whiteSpace: 'pre-line' }}>{bankDetails}</div>
          <FormMessage state={state} />
          <div className="pp-grid-2" style={{ gap: '0 16px' }}>
            <label className="pp-field"><span className="pp-label">Amount sent</span>
              <input className="pp-input" name="amount" type="number" step="0.01" min="1" max={balance} defaultValue={balance.toFixed(2)} required /></label>
            <label className="pp-field"><span className="pp-label">Date sent</span>
              <input className="pp-input" name="paid_on" type="date" max={today} defaultValue={today} required /></label>
          </div>
          <label className="pp-field"><span className="pp-label">Bank reference no.</span>
            <input className="pp-input" name="reference" required maxLength={100} /></label>
          <label className="pp-field"><span className="pp-label">Notes</span>
            <input className="pp-input" name="notes" maxLength={500} placeholder="Optional" /></label>
          <SubmitButton pendingText="Sending…">I&apos;ve sent the payment</SubmitButton>
        </form>
      )}
    </div>
  )
}
