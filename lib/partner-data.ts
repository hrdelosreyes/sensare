import 'server-only'
import { supabaseAdmin } from './supabase'
import { addDays, manilaToday, type Product } from './partner'

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

export type StockRow = {
  product_id: string
  product_name: string
  case_size: number
  on_hand: number
  sold_last_14: number
  avg_daily: number
  days_cover: number | null
  suggested_cases: number
}

// Stock on hand + sales velocity + reorder suggestion for one partner.
export async function getPartnerStock(partnerId: string, lowStockDays: number): Promise<StockRow[]> {
  const db = supabaseAdmin()
  const since = addDays(manilaToday(), -13)
  const [{ data: products }, { data: stock }, { data: sales }] = await Promise.all([
    db.from('sensare_products').select('id, name, case_size, sort_order').order('sort_order'),
    db.from('sensare_partner_stock').select('product_id, on_hand').eq('partner_id', partnerId),
    db.from('sensare_partner_sales').select('product_id, units_sold').eq('partner_id', partnerId).gte('sale_date', since),
  ])
  const onHand = new Map((stock ?? []).map(s => [s.product_id as string, Number(s.on_hand)]))
  const sold = new Map<string, number>()
  for (const s of sales ?? []) sold.set(s.product_id, (sold.get(s.product_id) ?? 0) + Number(s.units_sold))

  return (products ?? [])
    .filter(p => onHand.has(p.id) || sold.has(p.id))
    .map(p => {
      const oh = onHand.get(p.id) ?? 0
      const s14 = sold.get(p.id) ?? 0
      const avg = s14 / 14
      const daysCover = avg > 0 ? oh / avg : null
      const caseSize = p.case_size || 12
      // Suggest enough to cover 30 days of sales beyond the low-stock buffer.
      const target = Math.ceil(avg * (30 + lowStockDays))
      const suggested = daysCover !== null && daysCover < lowStockDays ? Math.max(1, Math.ceil((target - oh) / caseSize)) : 0
      return {
        product_id: p.id, product_name: p.name, case_size: caseSize,
        on_hand: oh, sold_last_14: s14, avg_daily: avg,
        days_cover: daysCover, suggested_cases: suggested,
      }
    })
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const { data } = await supabaseAdmin().from('sensare_settings').select('value').eq('key', key).maybeSingle()
  return (data?.value as string) ?? fallback
}

export async function getLowStockDays(): Promise<number> {
  const n = Number(await getSetting('partner_low_stock_days', '7'))
  return Number.isFinite(n) && n > 0 ? n : 7
}
