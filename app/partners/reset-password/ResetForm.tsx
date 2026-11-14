'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { updatePasswordAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'

export default function ResetForm({ continueHref = '/partners/portal' }: { continueHref?: string }) {
  const [state, action] = useActionState(updatePasswordAction, undefined)
  return (
    <form action={action} className="pp-card">
      <FormMessage state={state} />
      {state?.ok ? (
        <Link href={continueHref} className="pp-btn pp-btn-block">Continue</Link>
      ) : (
        <>
          <label className="pp-field"><span className="pp-label">New password</span>
            <input className="pp-input" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label className="pp-field"><span className="pp-label">Confirm password</span>
            <input className="pp-input" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
          <SubmitButton className="pp-btn pp-btn-block">Update password</SubmitButton>
        </>
      )}
    </form>
  )
}
