import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPartner, getUser } from '@/lib/auth'
import { fmtDate } from '@/lib/partner'
import { logoutAction } from '../actions'

export const metadata = { title: 'Application status', robots: { index: false } }

export default async function StatusPage() {
  const user = await getUser()
  if (!user) redirect('/partners/login')
  const partner = await getPartner()
  if (!partner) redirect('/partners/apply')
  if (partner.status === 'approved') redirect('/partners/portal')

  const content = {
    pending: {
      title: 'Your application is being reviewed',
      body: `Thanks for applying, ${partner.contact_name}. We received the application for ${partner.business_name} on ${fmtDate(partner.created_at)}. Our team usually reviews applications within 1–3 business days — we'll email ${partner.email} once you're approved.`,
      cls: 'pp-alert-info',
    },
    rejected: {
      title: 'Application not approved',
      body: `We're unable to approve the application for ${partner.business_name} at this time. If you have questions, email hello@mysensare.com.`,
      cls: 'pp-alert-warn',
    },
    suspended: {
      title: 'Account paused',
      body: `Access to the partner portal for ${partner.business_name} is currently paused. Please contact hello@mysensare.com.`,
      cls: 'pp-alert-warn',
    },
  }[partner.status]

  return (
    <div className="pp-page">
      <div className="pp-wrap-narrow">
        <p className="pp-eyebrow">Partner Program</p>
        <h1 className="pp-h1" style={{ marginBottom: 20 }}>{content.title}</h1>
        <div className={`pp-alert ${content.cls}`}>{content.body}</div>
        <div className="pp-row" style={{ marginTop: 24 }}>
          <Link href="/shop" className="pp-btn pp-btn-ghost">Browse products</Link>
          <form action={logoutAction}><button className="pp-btn pp-btn-ghost" type="submit">Log out</button></form>
        </div>
      </div>
    </div>
  )
}
