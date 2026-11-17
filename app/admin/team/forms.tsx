'use client'
import { useActionState } from 'react'
import { addAdminAction, changeOwnPasswordAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'

export function AddAdminForm() {
  const [state, action] = useActionState(addAdminAction, undefined)
  return (
    <ActionForm action={action}>
      <FormMessage state={state} />
      <label className="pp-field"><span className="pp-label">Name</span><input className="pp-input" name="name" maxLength={100} /></label>
      <label className="pp-field"><span className="pp-label">Email</span><input className="pp-input" name="email" type="email" required /></label>
      <label className="pp-field"><span className="pp-label">Temporary password</span>
        <input className="pp-input" name="password" type="text" minLength={10} autoComplete="off" />
        <span className="pp-hint">Required for new accounts (10+ characters). Leave blank if this person already has an account.</span></label>
      <SubmitButton>Add admin</SubmitButton>
    </ActionForm>
  )
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changeOwnPasswordAction, undefined)
  return (
    <ActionForm action={action}>
      <FormMessage state={state} />
      <label className="pp-field"><span className="pp-label">Current password</span><input className="pp-input" name="current" type="password" required autoComplete="current-password" /></label>
      <label className="pp-field"><span className="pp-label">New password</span><input className="pp-input" name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
      <label className="pp-field"><span className="pp-label">Confirm</span><input className="pp-input" name="confirm" type="password" required minLength={10} autoComplete="new-password" /></label>
      <SubmitButton>Update password</SubmitButton>
    </ActionForm>
  )
}
