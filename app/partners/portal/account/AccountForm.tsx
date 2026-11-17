'use client'
import { useActionState } from 'react'
import { updateAccountAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'
import type { Partner } from '@/lib/partner'

export default function AccountForm({ partner }: { partner: Partner }) {
  const [state, action] = useActionState(updateAccountAction, undefined)
  return (
    <ActionForm action={action}>
      <FormMessage state={state} />
      <label className="pp-field"><span className="pp-label">Contact person</span>
        <input className="pp-input" name="contact_name" defaultValue={partner.contact_name} required maxLength={200} /></label>
      <label className="pp-field"><span className="pp-label">Mobile number</span>
        <input className="pp-input" name="phone" defaultValue={partner.phone ?? ''} required maxLength={50} /></label>
      <label className="pp-field"><span className="pp-label">Address</span>
        <input className="pp-input" name="address" defaultValue={partner.address ?? ''} maxLength={300} /></label>
      <div className="pp-grid-2" style={{ gap: '0 16px' }}>
        <label className="pp-field"><span className="pp-label">City</span>
          <input className="pp-input" name="city" defaultValue={partner.city ?? ''} maxLength={100} /></label>
        <label className="pp-field"><span className="pp-label">Province</span>
          <input className="pp-input" name="province" defaultValue={partner.province ?? ''} maxLength={100} /></label>
      </div>
      <label className="pp-field"><span className="pp-label">Where you sell</span>
        <input className="pp-input" name="sales_channels" defaultValue={partner.sales_channels ?? ''} maxLength={500} /></label>
      <SubmitButton>Save details</SubmitButton>
    </ActionForm>
  )
}
