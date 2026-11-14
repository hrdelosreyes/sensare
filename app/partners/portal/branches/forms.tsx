'use client'
import { useActionState } from 'react'
import { saveLocationAction, toggleLocationAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import type { Location } from '@/lib/partner'

export function LocationForm({ location }: { location?: Location }) {
  const [state, action] = useActionState(saveLocationAction, undefined)
  const l = location
  return (
    <form action={action}>
      {l && <input type="hidden" name="location_id" value={l.id} />}
      <FormMessage state={state} />
      <div className="pp-grid-2" style={{ gap: '0 16px' }}>
        <label className="pp-field"><span className="pp-label">Branch name *</span>
          <input className="pp-input" name="name" required maxLength={100} defaultValue={l?.name} placeholder="e.g. BGC High Street" /></label>
        <label className="pp-field"><span className="pp-label">Contact person</span>
          <input className="pp-input" name="contact_name" maxLength={200} defaultValue={l?.contact_name ?? ''} /></label>
        <label className="pp-field"><span className="pp-label">Phone</span>
          <input className="pp-input" name="phone" type="tel" maxLength={50} defaultValue={l?.phone ?? ''} /></label>
        <label className="pp-field"><span className="pp-label">City *</span>
          <input className="pp-input" name="city" required maxLength={100} defaultValue={l?.city ?? ''} /></label>
      </div>
      <label className="pp-field"><span className="pp-label">Delivery address *</span>
        <input className="pp-input" name="address" required maxLength={300} defaultValue={l?.address ?? ''} /></label>
      <div className="pp-grid-2" style={{ gap: '0 16px' }}>
        <label className="pp-field"><span className="pp-label">Province</span>
          <input className="pp-input" name="province" maxLength={100} defaultValue={l?.province ?? ''} /></label>
        <label className="pp-field"><span className="pp-label">Delivery notes</span>
          <input className="pp-input" name="delivery_notes" maxLength={500} defaultValue={l?.delivery_notes ?? ''} placeholder="Receiving hours, landmarks…" /></label>
      </div>
      <SubmitButton className="pp-btn pp-btn-sm">{l ? 'Save branch' : 'Add branch'}</SubmitButton>
    </form>
  )
}

export function ToggleLocation({ id, active }: { id: string; active: boolean }) {
  const [state, action] = useActionState(toggleLocationAction, undefined)
  return (
    <form action={action} style={{ marginTop: active ? 0 : 14 }}>
      <input type="hidden" name="location_id" value={id} />
      <input type="hidden" name="active" value={active ? '1' : '0'} />
      <FormMessage state={state} />
      <SubmitButton className={active ? 'pp-btn pp-btn-ghost pp-btn-sm' : 'pp-btn pp-btn-danger pp-btn-sm'} pendingText="…">
        {active ? 'Reopen' : 'Close this branch'}
      </SubmitButton>
    </form>
  )
}
