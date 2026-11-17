'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { forgotPasswordAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, undefined)
  return (
    <div className="pp-page">
      <div className="pp-wrap-narrow" style={{ maxWidth: 440 }}>
        <h1 className="pp-h1" style={{ textAlign: 'center', marginBottom: 8 }}>Reset your password</h1>
        <p className="pp-muted" style={{ textAlign: 'center', marginBottom: 24 }}>We&apos;ll email you a link to set a new password.</p>
        <ActionForm action={action} className="pp-card">
          <FormMessage state={state} />
          <label className="pp-field"><span className="pp-label">Email</span>
            <input className="pp-input" name="email" type="email" required autoComplete="email" /></label>
          <SubmitButton pendingText="Sending…" className="pp-btn pp-btn-block">Send reset link</SubmitButton>
          <p style={{ marginTop: 18, fontSize: 14, textAlign: 'center' }}><Link href="/partners/login" className="pp-link">Back to login</Link></p>
        </ActionForm>
      </div>
    </div>
  )
}
