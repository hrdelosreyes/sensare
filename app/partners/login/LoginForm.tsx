'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { loginAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'

export default function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined)
  return (
    <ActionForm action={action} className="pp-card">
      <FormMessage state={state} />
      <label className="pp-field"><span className="pp-label">Email</span>
        <input className="pp-input" name="email" type="email" required autoComplete="email" /></label>
      <label className="pp-field"><span className="pp-label">Password</span>
        <input className="pp-input" name="password" type="password" required autoComplete="current-password" /></label>
      <SubmitButton pendingText="Signing in…" className="pp-btn pp-btn-block">Log in</SubmitButton>
      <div className="pp-row" style={{ justifyContent: 'space-between', marginTop: 18, fontSize: 14 }}>
        <Link href="/partners/forgot-password" className="pp-link">Forgot password?</Link>
        <Link href="/partners/apply" className="pp-link">Become a partner</Link>
      </div>
    </ActionForm>
  )
}
