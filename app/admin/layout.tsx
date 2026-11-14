import type { Metadata } from 'next'
import { getAdmin } from '@/lib/auth'
import NavTabs from '@/components/portal/NavTabs'
import { adminLogoutAction } from './actions'

// Keep the entire admin area out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const links = [
  { href: '/admin', label: 'Store', exact: true },
  { href: '/admin/partners', label: 'Partners' },
  { href: '/admin/partner-orders', label: 'Partner Orders' },
  { href: '/admin/partner-reports', label: 'Partner Reports' },
  { href: '/admin/partner-settings', label: 'Partner Settings' },
  { href: '/admin/team', label: 'Team' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin()
  // Not signed in as an admin: render bare (the login page); pages enforce access.
  if (!admin) return <>{children}</>

  return (
    <div className="pp-page">
      <div className="pp-wrap">
        <div className="pp-head no-print" style={{ marginBottom: 16 }}>
          <p className="pp-eyebrow" style={{ marginBottom: 0 }}>Sensarè Admin</p>
          <div className="pp-row">
            <span className="pp-muted">{admin.name || admin.email}</span>
            <form action={adminLogoutAction}><button type="submit" className="pp-btn pp-btn-ghost pp-btn-sm">Log out</button></form>
          </div>
        </div>
        <NavTabs links={links} />
        {children}
      </div>
    </div>
  )
}
