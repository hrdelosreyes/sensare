'use client'
import { useActionState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { adminLoginAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'

export default function AdminLoginForm({ needsSetup }: { needsSetup: boolean }) {
  const [state, action] = useActionState(adminLoginAction, undefined)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--espresso)', padding: '96px 24px 24px' }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <Image src="/logo-sensare.png" alt="Sensarè" width={64} height={64} style={{ objectFit: 'contain', margin: '0 auto 16px', display: 'block' }} />
        <p style={{ fontFamily: 'OleoScript', fontSize: 24, color: 'var(--rose-gold)', marginBottom: 4 }}>Sensarè</p>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 28 }}>Admin</p>

        <ActionForm action={action} style={{ textAlign: 'left' }}>
          <FormMessage state={state} />
          <label className="pp-field"><span className="pp-label">Email</span>
            <input className="pp-input" type="email" name="email" required autoComplete="username" /></label>
          <label className="pp-field"><span className="pp-label">Password</span>
            <input className="pp-input" type="password" name="password" required autoComplete="current-password" /></label>
          <SubmitButton pendingText="…" className="pp-btn pp-btn-block">Enter</SubmitButton>
          <p style={{ marginTop: 16, fontSize: 14, textAlign: 'center' }}>
            {needsSetup
              ? <Link href="/admin/setup" className="pp-link">First time? Create the first admin</Link>
              : <Link href="/partners/forgot-password" className="pp-link">Forgot password?</Link>}
          </p>
        </ActionForm>
      </div>
    </div>
  )
}
