import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdmin, getUser, getPartner } from '@/lib/auth'
import { db, one } from '@/lib/db'
import ApplyForm from './ApplyForm'

export const metadata: Metadata = {
  title: 'Apply — Partner Program',
  description: 'Apply to become a Sensarè partner or reseller.',
  alternates: { canonical: '/partners/apply' },
}

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [user, partner, staff] = await Promise.all([getUser(), getPartner(), getAdmin()])
  if (partner) redirect(partner.status === 'approved' ? '/partners/portal' : '/partners/status')
  const raw = ((await searchParams).ref ?? '').toUpperCase().slice(0, 20)
  const am = raw
    ? await one(db()<{ name: string | null; email: string }[]>`
        select name, email from sensare_admins where referral_code = ${raw} and role = 'account_manager' and is_active`)
    : null
  const ref = am ? raw : ''

  return (
    <div className="pp-page">
      <div className="pp-wrap" style={{ maxWidth: 760 }}>
        <p className="pp-eyebrow">Partner Program</p>
        <h1 className="pp-h1">Apply to become a partner</h1>
        <p className="pp-muted" style={{ marginBottom: 28 }}>
          Already applied? <Link href="/partners/login" className="pp-link">Log in</Link> to check your status.
        </p>
        {staff && (
          <div className="pp-alert pp-alert-info">
            You&apos;re signed in as staff ({staff.email}). This form creates a <strong>new partner login</strong> with the email and password below{staff.role === 'account_manager' || am ? ' and assigns the account to ' + (am ? (am.name || am.email) : 'you') : ''}. Your own session stays signed in.
          </div>
        )}
        {!staff && am && <p className="pp-muted" style={{ marginBottom: 16 }}>Your Sensarè account manager: <strong style={{ color: 'var(--cream)' }}>{am.name || am.email}</strong></p>}
        <ApplyForm loggedInEmail={staff ? null : user?.email ?? null} refCode={ref} />
      </div>
    </div>
  )
}
