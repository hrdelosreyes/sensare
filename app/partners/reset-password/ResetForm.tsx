'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { changePasswordAction, resetPasswordAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'

/** mode "reset": from an emailed link (token). mode "change": signed in, needs the current password. */
export default function ResetForm({ mode, token, continueHref = '/partners/portal' }: { mode: 'reset' | 'change'; token?: string; continueHref?: string }) {
  const [state, action] = useActionState(mode === 'reset' ? resetPasswordAction : changePasswordAction, undefined)
  return (
    <ActionForm action={action} className={mode === 'reset' ? 'pp-card' : undefined}>
      <FormMessage state={state} />
      {state?.ok && mode === 'reset' ? (
        <Link href={continueHref} className="pp-btn pp-btn-block">Continue</Link>
      ) : (
        <>
          {token && <input type="hidden" name="token" value={token} />}
          {mode === 'change' && (
            <label className="pp-field"><span className="pp-label">Current password</span>
              <input className="pp-input" name="current" type="password" required autoComplete="current-password" /></label>
          )}
          <label className="pp-field"><span className="pp-label">New password</span>
            <input className="pp-input" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label className="pp-field"><span className="pp-label">Confirm new password</span>
            <input className="pp-input" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
          <SubmitButton className={mode === 'reset' ? 'pp-btn pp-btn-block' : 'pp-btn'}>Update password</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
