import { redirect } from 'next/navigation'
import { hasAnyAdmin } from '@/lib/auth'
import SetupForm from './SetupForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin setup', robots: { index: false } }

export default async function AdminSetupPage() {
  if (await hasAnyAdmin()) redirect('/admin/login')
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--espresso)', padding: '96px 24px 24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <p className="pp-eyebrow" style={{ textAlign: 'center' }}>Sensarè Admin</p>
        <h1 className="pp-h1" style={{ textAlign: 'center' }}>Create the first admin</h1>
        <p className="pp-muted" style={{ textAlign: 'center', marginBottom: 24 }}>
          One-time setup. Enter the site&apos;s current admin password as the setup code, then choose your own login. This page closes once an admin exists.
        </p>
        <SetupForm />
      </div>
    </div>
  )
}
