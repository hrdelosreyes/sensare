import type { Metadata } from 'next'
import { requireApprovedPartnerPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import NavTabs from '@/components/portal/NavTabs'
import { logoutAction } from '../actions'

export const metadata: Metadata = {
  title: 'Partner Portal',
  robots: { index: false, follow: false },
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const partner = await requireApprovedPartnerPage()
  const db = supabaseAdmin()
  const [{ count: openSuggestions }, { count: consignmentOrders }] = await Promise.all([
    db.from('sensare_partner_order_suggestions').select('id', { count: 'exact', head: true }).eq('partner_id', partner.id).eq('status', 'open'),
    db.from('sensare_partner_orders').select('id', { count: 'exact', head: true }).eq('partner_id', partner.id).eq('payment_terms', 'consignment').neq('status', 'cancelled'),
  ])
  const showConsignment = partner.default_payment_terms === 'consignment' || (consignmentOrders ?? 0) > 0

  const links = [
    { href: '/partners/portal', label: 'Dashboard', exact: true },
    { href: '/partners/portal/suggested', label: openSuggestions ? 'Suggested Order •' : 'Suggested Order' },
    { href: '/partners/portal/order', label: 'New Order' },
    { href: '/partners/portal/orders', label: 'Orders' },
    { href: '/partners/portal/inventory', label: 'Inventory' },
    { href: '/partners/portal/sales', label: 'Daily Sales' },
    ...(showConsignment ? [{ href: '/partners/portal/consignment', label: 'Consignment' }] : []),
    { href: '/partners/portal/reports', label: 'Reports' },
    { href: '/partners/portal/branches', label: 'Branches' },
    { href: '/partners/portal/account', label: 'Account' },
  ]

  return (
    <div className="pp-page">
      <div className="pp-wrap">
        <div className="pp-head no-print" style={{ marginBottom: 16 }}>
          <div>
            <p className="pp-eyebrow">Sensarè Partner Portal</p>
            <p style={{ fontWeight: 700, fontSize: 20, color: 'var(--cream)' }}>{partner.business_name}</p>
          </div>
          <form action={logoutAction}><button type="submit" className="pp-btn pp-btn-ghost pp-btn-sm">Log out</button></form>
        </div>
        <NavTabs links={links} />
        {children}
      </div>
    </div>
  )
}
