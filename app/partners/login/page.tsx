import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getPartner } from '@/lib/auth'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Partner Login',
  robots: { index: false, follow: true },
}

export default async function PartnerLoginPage() {
  const partner = await getPartner()
  if (partner) redirect(partner.status === 'approved' ? '/partners/portal' : '/partners/status')

  return (
    <div className="pp-page">
      <div className="pp-wrap-narrow" style={{ maxWidth: 440 }}>
        <p className="pp-eyebrow" style={{ textAlign: 'center' }}>Sensarè</p>
        <h1 className="pp-h1" style={{ textAlign: 'center', marginBottom: 28 }}>Partner Login</h1>
        <LoginForm />
      </div>
    </div>
  )
}
