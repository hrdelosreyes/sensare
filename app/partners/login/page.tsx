import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getPartner } from '@/lib/auth'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Partner Login',
  robots: { index: false, follow: true },
}

export default async function PartnerLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const partner = await getPartner()
  if (partner) redirect(partner.status === 'approved' ? '/partners/portal' : '/partners/status')
  const { error } = await searchParams

  return (
    <div className="pp-page">
      <div className="pp-wrap-narrow" style={{ maxWidth: 440 }}>
        <p className="pp-eyebrow" style={{ textAlign: 'center' }}>Sensarè</p>
        <h1 className="pp-h1" style={{ textAlign: 'center', marginBottom: 28 }}>Partner Login</h1>
        {error === 'link' && <div className="pp-alert pp-alert-error">That link is invalid or has expired. Please request a new one.</div>}
        <LoginForm />
      </div>
    </div>
  )
}
