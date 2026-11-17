'use client'
import { useActionState } from 'react'
import { setupFirstAdminAction } from './actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'

export default function SetupForm() {
  const [state, action] = useActionState(setupFirstAdminAction, undefined)
  return (
    <ActionForm action={action} className="pp-card">
      <FormMessage state={state} />
      <label className="pp-field"><span className="pp-label">Setup code (current admin password)</span>
        <input className="pp-input" name="code" type="password" required autoComplete="off" /></label>
      <label className="pp-field"><span className="pp-label">Your name</span>
        <input className="pp-input" name="name" maxLength={100} autoComplete="name" /></label>
      <label className="pp-field"><span className="pp-label">Your email</span>
        <input className="pp-input" name="email" type="email" required autoComplete="username" /></label>
      <label className="pp-field"><span className="pp-label">Choose a password</span>
        <input className="pp-input" name="password" type="password" required minLength={10} autoComplete="new-password" />
        <span className="pp-hint">At least 10 characters.</span></label>
      <label className="pp-field"><span className="pp-label">Confirm password</span>
        <input className="pp-input" name="confirm" type="password" required minLength={10} autoComplete="new-password" /></label>
      <SubmitButton pendingText="Creating…" className="pp-btn pp-btn-block">Create admin & sign in</SubmitButton>
    </ActionForm>
  )
}
