import { requireAdminPage } from '@/lib/auth'
import { ROLES } from '@/lib/roles'
import { SITE_URL } from '@/lib/seo'
import CopyLink from '@/components/portal/CopyLink'
import { ChangePasswordForm } from '../team/forms'

export default async function MyAccountPage() {
  const admin = await requireAdminPage()
  return (
    <div className="pp-stack">
      <h1 className="pp-h1">My account</h1>
      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Profile</p>
          <dl className="pp-dl">
            <dt>Name</dt><dd>{admin.name || '—'}</dd>
            <dt>Email</dt><dd>{admin.email}</dd>
            <dt>Role</dt><dd>{ROLES[admin.role].label}<br /><span className="pp-muted" style={{ fontSize: 13 }}>{ROLES[admin.role].description}</span></dd>
            {admin.role === 'account_manager' && <><dt>Commission</dt><dd>{admin.commission_pct ?? 0}% of confirmed collections</dd></>}
          </dl>
          {admin.role === 'account_manager' && admin.referral_code && (
            <>
              <p className="pp-h3" style={{ marginTop: 20 }}>Your partner sign-up link</p>
              <CopyLink url={`${SITE_URL}/partners/apply?ref=${admin.referral_code}`} />
            </>
          )}
        </div>
        <div className="pp-card">
          <p className="pp-h2">Change password</p>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  )
}
