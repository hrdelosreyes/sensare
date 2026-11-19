// Staff roles and what each may do. Shared by server guards and UI (client-safe).
// Every permission is enforced on the server; the UI only hides what a role can't use.

export type StaffRole = 'owner' | 'manager' | 'fulfillment' | 'finance' | 'viewer' | 'account_manager'

export const ROLES: Record<StaffRole, { label: string; description: string }> = {
  owner: { label: 'Owner', description: 'Everything, including the team, settings and default prices.' },
  manager: { label: 'Manager', description: 'Partners, prices, orders, payments and reports. No team or settings.' },
  fulfillment: { label: 'Fulfillment', description: 'Confirm, ship and deliver orders and update shop stock. No prices or payments.' },
  finance: { label: 'Finance', description: 'Verify and record payments and consignment, reports and commissions.' },
  viewer: { label: 'Viewer', description: 'Read-only access to partners, orders and reports.' },
  account_manager: { label: 'Account Manager', description: 'Only their own partner accounts: orders, inventory, deliveries, collections and reports. Earns commission.' },
}

export const ROLE_ORDER: StaffRole[] = ['owner', 'manager', 'fulfillment', 'finance', 'viewer', 'account_manager']

export function isStaffRole(v: unknown): v is StaffRole {
  return typeof v === 'string' && v in ROLES
}

export type Permission =
  | 'team.manage'          // add/remove staff, change roles and commission
  | 'settings.manage'      // bank details, forecast settings, default case prices
  | 'store.view'           // online store dashboard (shop orders, products)
  | 'store.stock'          // change shop stock
  | 'money.view'           // see prices, totals, balances, revenue
  | 'partners.view'        // partner list & details (account managers: own only)
  | 'partners.approve'     // approve / reject / suspend partners
  | 'partners.edit'        // terms, notes, consignment period, account manager, stock adjustments
  | 'partners.prices'      // per-partner price lists
  | 'partners.suggest'     // recalculate a partner's suggested order
  | 'orders.view'          // partner orders (account managers: own only)
  | 'orders.fulfill'       // confirm, ship, deliver, cancel
  | 'orders.edit'          // payment terms, shipping fee, due date, notes
  | 'payments.record'      // record a payment that counts immediately
  | 'payments.collect'     // log a collection for Finance to confirm
  | 'payments.review'      // confirm / reject reported payments and collections
  | 'consignment.view'
  | 'reports.view'
  | 'commissions.view_all'
  | 'commissions.view_own'

const ALL: StaffRole[] = ['owner', 'manager', 'fulfillment', 'finance', 'viewer', 'account_manager']

const GRANTS: Record<Permission, StaffRole[]> = {
  'team.manage': ['owner'],
  'settings.manage': ['owner'],
  'store.view': ['owner', 'manager', 'fulfillment', 'finance', 'viewer'],
  'store.stock': ['owner', 'manager', 'fulfillment'],
  'money.view': ['owner', 'manager', 'finance', 'viewer', 'account_manager'],
  'partners.view': ['owner', 'manager', 'finance', 'viewer', 'account_manager'],
  'partners.approve': ['owner', 'manager'],
  'partners.edit': ['owner', 'manager'],
  'partners.prices': ['owner', 'manager'],
  'partners.suggest': ['owner', 'manager', 'account_manager'],
  'orders.view': ALL,
  'orders.fulfill': ['owner', 'manager', 'fulfillment'],
  'orders.edit': ['owner', 'manager'],
  'payments.record': ['owner', 'manager', 'finance'],
  'payments.collect': ['account_manager'],
  'payments.review': ['owner', 'manager', 'finance'],
  'consignment.view': ['owner', 'manager', 'finance', 'viewer', 'account_manager'],
  'reports.view': ['owner', 'manager', 'finance', 'viewer', 'account_manager'],
  'commissions.view_all': ['owner', 'finance'],
  'commissions.view_own': ['account_manager'],
}

export function can(role: StaffRole | null | undefined, perm: Permission): boolean {
  return !!role && GRANTS[perm].includes(role)
}

/** Account managers only ever see their assigned partners. */
export function isScoped(role: StaffRole): boolean {
  return role === 'account_manager'
}

export const NAV: { href: string; label: string; exact?: boolean; perm: Permission | Permission[] }[] = [
  { href: '/admin', label: 'Store', exact: true, perm: 'store.view' },
  { href: '/admin/partners', label: 'Partners', perm: 'partners.view' },
  { href: '/admin/partner-orders', label: 'Partner Orders', perm: 'orders.view' },
  { href: '/admin/consignment', label: 'Consignment', perm: 'consignment.view' },
  { href: '/admin/partner-reports', label: 'Partner Reports', perm: 'reports.view' },
  { href: '/admin/commissions', label: 'Commissions', perm: ['commissions.view_all', 'commissions.view_own'] },
  { href: '/admin/partner-settings', label: 'Partner Settings', perm: 'settings.manage' },
  { href: '/admin/team', label: 'Team', perm: 'team.manage' },
  { href: '/admin/account', label: 'My Account', perm: 'orders.view' }, // every role
]

export function navFor(role: StaffRole) {
  return NAV
    .filter(n => (Array.isArray(n.perm) ? n.perm : [n.perm]).some(p => can(role, p)))
    .map(n => (role === 'account_manager' && n.href === '/admin/partners' ? { ...n, label: 'My Accounts' } : n))
}

/** Where a role lands after signing in. */
export function homeFor(role: StaffRole): string {
  return navFor(role)[0]?.href ?? '/admin/account'
}
