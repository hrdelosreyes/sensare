'use client'
import { useActionState, useState, useTransition } from 'react'
import { payConsignmentOnlineAction, reportConsignmentTransferAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { peso } from '@/lib/partner'

export default function SettlePanel({ to, amount, bankDetails, today }: { to: string; amount: number; bankDetails: string; today: string }) {
  const [tab, setTab] = useState<'online' | 'bank'>('online')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const [state, action] = useActionState(reportConsignmentTransferAction, undefined)

  function payOnline() {
    setErr('')
    start(async () => {
      const res = await payConsignmentOnlineAction(to)
      if (res.url) window.location.href = res.url
      else setErr(res.error || 'Something went wrong.')
    })
  }

  return (
    <div className="no-print" style={{ marginTop: 20, borderTop: '1px solid rgba(201,144,106,0.15)', paddingTop: 20 }}>
      <p className="pp-h3">Pay {peso(amount)}</p>
      <div className="pp-row" style={{ marginBottom: 16 }}>
        <button type="button" className={`pp-btn pp-btn-sm ${tab === 'online' ? '' : 'pp-btn-ghost'}`} onClick={() => setTab('online')}>Pay online</button>
        <button type="button" className={`pp-btn pp-btn-sm ${tab === 'bank' ? '' : 'pp-btn-ghost'}`} onClick={() => setTab('bank')}>Bank transfer</button>
      </div>
      {tab === 'online' ? (
        <div>
          {err && <div className="pp-alert pp-alert-error">{err}</div>}
          <button type="button" className="pp-btn" onClick={payOnline} disabled={pending}>{pending ? 'Redirecting…' : `Pay ${peso(amount, 0)} via HitPay`}</button>
          <p className="pp-hint" style={{ marginTop: 8 }}>Card, GCash, Maya or online banking.</p>
        </div>
      ) : (
        <form action={action} style={{ maxWidth: 520 }}>
          <input type="hidden" name="period_to" value={to} />
          <div className="pp-alert pp-alert-info" style={{ whiteSpace: 'pre-line' }}>{bankDetails}</div>
          <FormMessage state={state} />
          {!state?.ok && <>
            <div className="pp-grid-2" style={{ gap: '0 16px' }}>
              <label className="pp-field"><span className="pp-label">Bank reference no.</span>
                <input className="pp-input" name="reference" required maxLength={100} /></label>
              <label className="pp-field"><span className="pp-label">Date sent</span>
                <input className="pp-input" name="paid_on" type="date" max={today} defaultValue={today} required /></label>
            </div>
            <label className="pp-field"><span className="pp-label">Notes</span><input className="pp-input" name="notes" maxLength={500} /></label>
            <SubmitButton pendingText="Sending…">I&apos;ve sent {peso(amount, 0)}</SubmitButton>
          </>}
        </form>
      )}
    </div>
  )
}
