import 'server-only'
import { db, one } from './db'
import type { Location, Product } from './partner'

export type CatalogItem = Product & {
  effective_case_price: number | null // null → not orderable (no price set)
  custom_price: number | null
  available: boolean
}

// Products a partner can order, with their custom case price
// (falls back to the product's default wholesale case price).
export async function getPartnerCatalog(partnerId: string, includeUnavailable = false): Promise<CatalogItem[]> {
  const rows = await db()<(Product & { custom_price: number | null; pp_available: boolean | null })[]>`
    select p.*, pp.case_price_php as custom_price, pp.is_available as pp_available
    from sensare_products p
    left join sensare_partner_prices pp on pp.product_id = p.id and pp.partner_id = ${partnerId}
    where p.is_active and p.is_wholesale
    order by p.sort_order`
  const items = rows.map(({ pp_available, ...p }) => ({
    ...p,
    case_size: p.case_size || 12,
    effective_case_price: p.custom_price ?? p.wholesale_case_price_php ?? null,
    available: pp_available !== false,
  }))
  return includeUnavailable ? items : items.filter(i => i.available && i.effective_case_price != null)
}

export async function getLocations(partnerId: string, activeOnly = true): Promise<Location[]> {
  return db()<Location[]>`
    select * from sensare_partner_locations
    where partner_id = ${partnerId} ${activeOnly ? db()`and is_active` : db()``}
    order by is_default desc, name`
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const row = await one(db()<{ value: string | null }[]>`select value from sensare_settings where key = ${key}`)
  return row?.value ?? fallback
}
