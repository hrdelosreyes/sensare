'use client'
import { useActionState } from 'react'
import { approveSuggestionAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { PAYMENT_TERMS, type PaymentTerms } from '@/lib/partner'

export default function ApproveForm({ suggestionId, defaultTerms }: { suggestionId: string; defaultTerms: PaymentTerms }) {
  const [state, action] = useActionState(approveSuggestionAction, undefined)
  return (
    <form action={action} style={{ minWidth: 260 }}>
      <input type="hidden" name="suggestion_id" value={suggestionId} />
      <FormMessage state={state} />
      <label className="pp-field"><span className="pp-label">Payment terms</span>
        <select className="pp-select" name="payment_terms" defaultValue={defaultTerms}>
          {(Object.keys(PAYMENT_TERMS) as PaymentTerms[]).map(t => <option key={t} value={t}>{PAYMENT_TERMS[t]}{t === defaultTerms ? ' (default)' : ''}</option>)}
        </select></label>
      <SubmitButton pendingText="Placing order…" className="pp-btn pp-btn-block">Approve & place order</SubmitButton>
    </form>
  )
}
