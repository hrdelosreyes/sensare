import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser, getPartner } from '@/lib/auth'
import ApplyForm from './ApplyForm'

export const metadata: Metadata = {
  title: 'Apply — Partner Program',
  description: 'Apply to become a Sensarè partner or reseller.',
  alternates: { canonical: '/partners/apply' },
}

export default async function ApplyPage() {
  const [user, partner] = await Promise.all([getUser(), getPartner()])
  if (partner) redirect(partner.status === 'approved' ? '/partners/portal' : '/partners/status')

  return (
    <div className="pp-page">
      <div className="pp-wrap" style={{ maxWidth: 760 }}>
        <p className="pp-eyebrow">Partner Program</p>
        <h1 className="pp-h1">Apply to become a partner</h1>
        <p className="pp-muted" style={{ marginBottom: 28 }}>
          Already applied? <Link href="/partners/login" className="pp-link">Log in</Link> to check your status.
        </p>
        <ApplyForm loggedInEmail={user?.email ?? null} />
      </div>
    </div>
  )
}
