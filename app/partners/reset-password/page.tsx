import Link from 'next/link'
import { checkPasswordReset } from '@/lib/auth'
import ResetForm from './ResetForm'

export const metadata = { title: 'Set new password', robots: { index: false } }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams
  const valid = await checkPasswordReset(token)
  return (
    <div className="pp-page">
      <div className="pp-wrap-narrow" style={{ maxWidth: 440 }}>
        <h1 className="pp-h1" style={{ textAlign: 'center', marginBottom: 24 }}>Set a new password</h1>
        {valid ? (
          <>
            <p className="pp-muted" style={{ textAlign: 'center', marginBottom: 16 }}>For {valid.email}</p>
            <ResetForm mode="reset" token={token} />
          </>
        ) : (
          <div className="pp-card">
            <div className="pp-alert pp-alert-error">This link is invalid or has expired.</div>
            <Link href="/partners/forgot-password" className="pp-btn pp-btn-block">Request a new link</Link>
          </div>
        )}
      </div>
    </div>
  )
}
