import 'server-only'
import { supabaseAdmin } from './supabase'
import { getLocations, getPartnerCatalog, getSetting } from './partner-data'
import { addDays, locationLabel, manilaToday, type Location, type Partner } from './partner'
import { DEFAULT_FORECAST, planLine, type ForecastSettings } from './forecast-math'
import { email } from './email'

export type StockLine = {
  location_id: string
  location_name: string
  product_id: string
  product_name: string
  case_size: number
  on_hand: number
  on_order: number
  sold_14: number
  avg_daily: number
  trend_pct: number | null
  days_cover: number | null
  stockout_date: string | null
  needs_reorder: boolean
  suggested_cases: number
}

export async function getForecastSettings(): Promise<ForecastSettings> {
  const [l, c, s] = await Promise.all([
    getSetting('partner_lead_time_days', String(DEFAULT_FORECAST.leadTimeDays)),
    getSetting('partner_cover_days', String(DEFAULT_FORECAST.coverDays)),
    getSetting('partner_safety_days', String(DEFAULT_FORECAST.safetyDays)),
  ])
  const n = (v: string, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d)
  return {
    leadTimeDays: n(l, DEFAULT_FORECAST.leadTimeDays),
    coverDays: n(c, DEFAULT_FORECAST.coverDays),
    safetyDays: n(s, DEFAULT_FORECAST.safetyDays),
  }
}

const OPEN_STATUSES = ['submitted', 'confirmed', 'shipped']

// Stock position, sales velocity and reorder need for every location × product.
export async function getStockPlan(partnerId: string, settings?: ForecastSettings, locations?: Location[]): Promise<StockLine[]> {
  const db = supabaseAdmin()
  const today = manilaToday()
  const since = addDays(today, -27)
  const [cfg, locs, { data: products }, { data: stock }, { data: history }, { data: openItems }] = await Promise.all([
    settings ? Promise.resolve(settings) : getForecastSettings(),
    locations ? Promise.resolve(locations) : getLocations(partnerId, false),
    db.from('sensare_products').select('id, name, case_size, sort_order').order('sort_order'),
    db.from('sensare_partner_stock').select('location_id, product_id, on_hand, first_received').eq('partner_id', partnerId),
    db.rpc('sensare_partner_sales_history', { p_partner_id: partnerId, p_from: since }),
    db.from('sensare_partner_order_items')
      .select('product_id, case_qty, case_size, sensare_partner_orders!inner(location_id, partner_id, status)')
      .eq('sensare_partner_orders.partner_id', partnerId)
      .in('sensare_partner_orders.status', OPEN_STATUSES),
  ])

  const key = (l: string, p: string) => `${l}|${p}`
  const lines = new Map<string, { onHand: number; firstReceived: string | null; recent: number; prior: number; onOrder: number }>()
  const get = (k: string) => {
    if (!lines.has(k)) lines.set(k, { onHand: 0, firstReceived: null, recent: 0, prior: 0, onOrder: 0 })
    return lines.get(k)!
  }
  for (const s of stock ?? []) Object.assign(get(key(s.location_id, s.product_id)), { onHand: Number(s.on_hand), firstReceived: s.first_received })
  const recentFrom = addDays(today, -13)
  for (const h of (history ?? []) as { location_id: string; product_id: string; sale_date: string; units: number }[]) {
    const l = get(key(h.location_id, h.product_id))
    if (h.sale_date >= recentFrom) l.recent += Number(h.units)
    else l.prior += Number(h.units)
  }
  type OpenItem = { product_id: string; case_qty: number; case_size: number; sensare_partner_orders: { location_id: string } | { location_id: string }[] }
  for (const it of (openItems ?? []) as OpenItem[]) {
    const o = Array.isArray(it.sensare_partner_orders) ? it.sensare_partner_orders[0] : it.sensare_partner_orders
    get(key(o.location_id, it.product_id)).onOrder += it.case_qty * it.case_size
  }

  const locById = new Map(locs.map(l => [l.id, l]))
  const prodById = new Map((products ?? []).map(p => [p.id as string, p]))
  const out: StockLine[] = []
  for (const [k, v] of lines) {
    const [locationId, productId] = k.split('|')
    const loc = locById.get(locationId)
    const prod = prodById.get(productId)
    if (!loc || !prod) continue
    const daysOfHistory = v.firstReceived ? Math.round((Date.parse(today) - Date.parse(v.firstReceived)) / 86400000) + 1 : 0
    const r = planLine({ onHand: v.onHand, onOrder: v.onOrder, caseSize: prod.case_size || 12, recent14: v.recent, prior14: v.prior, daysOfHistory }, cfg)
    out.push({
      location_id: locationId, location_name: locationLabel(loc),
      product_id: productId, product_name: prod.name, case_size: prod.case_size || 12,
      on_hand: v.onHand, on_order: v.onOrder, sold_14: v.recent,
      avg_daily: r.avgDaily, trend_pct: r.trendPct, days_cover: r.daysCover,
      stockout_date: r.daysCover !== null ? addDays(today, Math.floor(r.daysCover)) : null,
      needs_reorder: r.needsReorder, suggested_cases: r.suggestedCases,
    })
  }
  const locOrder = new Map(locs.map((l, i) => [l.id, i]))
  const prodOrder = new Map((products ?? []).map((p, i) => [p.id as string, i]))
  return out.sort((a, b) => (locOrder.get(a.location_id)! - locOrder.get(b.location_id)!) || (prodOrder.get(a.product_id)! - prodOrder.get(b.product_id)!))
}

/**
 * Creates or refreshes the partner's open order suggestion from current stock
 * and sales. Returns the open suggestion id, or null when nothing is needed.
 * Emails the partner when a new suggestion opens (notify = true).
 */
export async function refreshSuggestion(partner: Pick<Partner, 'id' | 'email' | 'contact_name' | 'status'>, notify = false): Promise<string | null> {
  if (partner.status !== 'approved') return null
  const db = supabaseAdmin()
  const cfg = await getForecastSettings()
  const [plan, catalog, { data: open }, { data: recentDismissal }] = await Promise.all([
    getStockPlan(partner.id, cfg),
    getPartnerCatalog(partner.id),
    db.from('sensare_partner_order_suggestions').select('id').eq('partner_id', partner.id).eq('status', 'open').maybeSingle(),
    db.from('sensare_partner_order_suggestions').select('id').eq('partner_id', partner.id).eq('status', 'dismissed')
      .gte('decided_at', new Date(Date.now() - 2 * 86400000).toISOString()).limit(1),
  ])
  const orderable = new Set(catalog.map(c => c.id))
  const activeLocations = new Set((await getLocations(partner.id)).map(l => l.id))
  const lines = plan.filter(p => p.suggested_cases > 0 && orderable.has(p.product_id) && activeLocations.has(p.location_id))

  if (!lines.length) {
    if (open) await db.from('sensare_partner_order_suggestions').update({ status: 'superseded', decided_at: new Date().toISOString() }).eq('id', open.id)
    return null
  }

  let id = open?.id as string | undefined
  const isNew = !id
  if (isNew && recentDismissal?.length) return null // respect a recent "not now"

  const header = { lead_time_days: cfg.leadTimeDays, cover_days: cfg.coverDays, safety_days: cfg.safetyDays, generated_at: new Date().toISOString() }
  if (id) {
    await db.from('sensare_partner_order_suggestions').update(header).eq('id', id)
    await db.from('sensare_partner_order_suggestion_lines').delete().eq('suggestion_id', id)
  } else {
    const { data, error } = await db.from('sensare_partner_order_suggestions').insert({ partner_id: partner.id, ...header }).select('id').single()
    if (error || !data) {
      // A concurrent refresh may have opened one first.
      const { data: again } = await db.from('sensare_partner_order_suggestions').select('id').eq('partner_id', partner.id).eq('status', 'open').maybeSingle()
      if (!again) { console.error('Suggestion insert failed', error); return null }
      return refreshSuggestion(partner, false)
    }
    id = data.id as string
  }

  await db.from('sensare_partner_order_suggestion_lines').insert(lines.map(l => ({
    suggestion_id: id, location_id: l.location_id, product_id: l.product_id,
    suggested_cases: l.suggested_cases, case_size: l.case_size, on_hand: l.on_hand, on_order: l.on_order,
    avg_daily: Math.round(l.avg_daily * 1000) / 1000,
    trend_pct: l.trend_pct === null ? null : Math.round(l.trend_pct * 10) / 10,
    days_cover: l.days_cover === null ? null : Math.round(l.days_cover * 10) / 10,
    stockout_date: l.stockout_date,
  })))

  if (isNew && notify) {
    const cases = lines.reduce((s, l) => s + l.suggested_cases, 0)
    await email.suggestionReady(partner, cases, new Set(lines.map(l => l.location_id)).size)
    await db.from('sensare_partner_order_suggestions').update({ notified_at: new Date().toISOString() }).eq('id', id)
  }
  return id!
}

/** Refreshes the open suggestion if it is missing or older than 12 hours. Never throws. */
export async function ensureFreshSuggestion(partner: Partner) {
  try {
    const { data } = await supabaseAdmin().from('sensare_partner_order_suggestions')
      .select('generated_at').eq('partner_id', partner.id).eq('status', 'open').maybeSingle()
    if (!data || Date.now() - Date.parse(data.generated_at) > 12 * 3600_000) await refreshSuggestion(partner)
  } catch (e) {
    console.error('Suggestion refresh failed', e)
  }
}
