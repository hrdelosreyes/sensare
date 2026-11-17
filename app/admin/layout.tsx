import type { Metadata } from 'next'
import { getAdmin } from '@/lib/auth'
import NavTabs from '@/components/portal/NavTabs'
import { adminLogoutAction } from './actions'
import { navFor, ROLES } from '@/lib/roles'

// Keep the entire admin area out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}


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
            <span className="pp-muted">{admin.name || admin.email} · {ROLES[admin.role].label}</span>
            <form action={adminLogoutAction}><button type="submit" className="pp-btn pp-btn-ghost pp-btn-sm">Log out</button></form>
          </div>
        </div>
        <NavTabs links={navFor(admin.role).map(({ href, label, exact }) => ({ href, label, exact }))} />
        {children}
      </div>
    </div>
  )
}
