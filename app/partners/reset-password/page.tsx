import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import ResetForm from './ResetForm'

export const metadata = { title: 'Set new password', robots: { index: false } }

export default async function ResetPasswordPage() {
  const user = await getUser()
  if (!user) redirect('/partners/login?error=link')
  return (
    <div className="pp-page">
      <div className="pp-wrap-narrow" style={{ maxWidth: 440 }}>
        <h1 className="pp-h1" style={{ textAlign: 'center', marginBottom: 24 }}>Set a new password</h1>
        <ResetForm />
      </div>
    </div>
  )
}
