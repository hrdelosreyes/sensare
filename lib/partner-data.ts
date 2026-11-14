import 'server-only'
import { supabaseAdmin } from './supabase'
import type { Location, Product } from './partner'

export type CatalogItem = Product & {
  effective_case_price: number | null // null → not orderable (no price set)
  custom_price: number | null
  available: boolean
}

// Products a partner can order, with their custom case price
// (falls back to the product's default wholesale case price).
export async function getPartnerCatalog(partnerId: string, includeUnavailable = false): Promise<CatalogItem[]> {
  const db = supabaseAdmin()
  const [{ data: products }, { data: prices }] = await Promise.all([
    db.from('sensare_products').select('*').eq('is_active', true).eq('is_wholesale', true).order('sort_order'),
    db.from('sensare_partner_prices').select('*').eq('partner_id', partnerId),
  ])
  const byProduct = new Map((prices ?? []).map(p => [p.product_id as string, p]))
  const items = ((products ?? []) as Product[]).map(p => {
    const pp = byProduct.get(p.id)
    const custom = pp?.case_price_php != null ? Number(pp.case_price_php) : null
    const fallback = p.wholesale_case_price_php != null ? Number(p.wholesale_case_price_php) : null
    const available = pp ? pp.is_available !== false : true
    return {
      ...p,
      case_size: p.case_size || 12,
      custom_price: custom,
      effective_case_price: custom ?? fallback,
      available,
    }
  })
  return includeUnavailable ? items : items.filter(i => i.available && i.effective_case_price != null)
}

export async function getLocations(partnerId: string, activeOnly = true): Promise<Location[]> {
  let q = supabaseAdmin().from('sensare_partner_locations').select('*').eq('partner_id', partnerId)
    .order('is_default', { ascending: false }).order('name')
  if (activeOnly) q = q.eq('is_active', true)
  const { data } = await q
  return (data ?? []) as Location[]
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const { data } = await supabaseAdmin().from('sensare_settings').select('value').eq('key', key).maybeSingle()
  return (data?.value as string) ?? fallback
}

