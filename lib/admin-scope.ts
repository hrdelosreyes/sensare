import 'server-only'
import { db } from './db'
import type { Admin } from './auth'

/**
 * Partners a staff member may report on, and the id filter to apply to
 * "all partners" reports: null (everyone) for most roles, the assigned
 * accounts for an account manager.
 */
export async function reportScope(admin: Admin) {
  const isAm = admin.role === 'account_manager'
  const partners = await db()<{ id: string; business_name: string; status: string }[]>`
    select id, business_name, status from sensare_partners
    where ${isAm ? db()`account_manager_id = ${admin.user_id}` : db()`status in ('approved', 'suspended')`}
    order by business_name`
  return { partners, scopeIds: isAm ? partners.map(p => p.id) : null }
}
