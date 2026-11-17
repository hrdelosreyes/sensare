import 'server-only'
import { db, one } from './db'
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

// Stock position, sales velocity and reorder need for every location × product.
export async function getStockPlan(partnerId: string, settings?: ForecastSettings, locations?: Location[]): Promise<StockLine[]> {
  const today = manilaToday()
  const recentFrom = addDays(today, -13)
  const priorFrom = addDays(today, -27)
  const [cfg, locs, rows] = await Promise.all([
    settings ? Promise.resolve(settings) : getForecastSettings(),
    locations ? Promise.resolve(locations) : getLocations(partnerId, false),
    db()<{
      location_id: string; product_id: string; product_name: string; case_size: number; sort_order: number
      on_hand: number; first_received: string | null; recent: number; prior: number; on_order: number
    }[]>`
      with keys as (
        select location_id, product_id from sensare_partner_stock where partner_id = ${partnerId}
        union
        select location_id, product_id from sensare_partner_sales where partner_id = ${partnerId} and sale_date >= ${priorFrom}::date
        union
        select o.location_id, i.product_id from sensare_partner_order_items i
          join sensare_partner_orders o on o.id = i.order_id
          where o.partner_id = ${partnerId} and o.status in ('submitted', 'confirmed', 'shipped')
      )
      select k.location_id, k.product_id, p.name as product_name, coalesce(p.case_size, 12) as case_size, p.sort_order,
        coalesce(st.on_hand, 0) as on_hand, st.first_received,
        coalesce((select sum(units_sold) from sensare_partner_sales s
                  where s.location_id = k.location_id and s.product_id = k.product_id and s.sale_date >= ${recentFrom}::date), 0)::int as recent,
        coalesce((select sum(units_sold) from sensare_partner_sales s
                  where s.location_id = k.location_id and s.product_id = k.product_id
                    and s.sale_date >= ${priorFrom}::date and s.sale_date < ${recentFrom}::date), 0)::int as prior,
        coalesce((select sum(i.case_qty * i.case_size) from sensare_partner_order_items i
                  join sensare_partner_orders o on o.id = i.order_id
                  where o.location_id = k.location_id and i.product_id = k.product_id
                    and o.status in ('submitted', 'confirmed', 'shipped')), 0)::int as on_order
      from keys k
      join sensare_products p on p.id = k.product_id
      left join sensare_partner_stock st on st.location_id = k.location_id and st.product_id = k.product_id`,
  ])

  const locById = new Map(locs.map(l => [l.id, l]))
  const locOrder = new Map(locs.map((l, i) => [l.id, i]))
  const out: StockLine[] = []
  for (const v of rows) {
    const loc = locById.get(v.location_id)
    if (!loc) continue
    const daysOfHistory = v.first_received ? Math.round((Date.parse(today) - Date.parse(v.first_received)) / 86400000) + 1 : 0
    const r = planLine({ onHand: v.on_hand, onOrder: v.on_order, caseSize: v.case_size, recent14: v.recent, prior14: v.prior, daysOfHistory }, cfg)
    out.push({
      location_id: v.location_id, location_name: locationLabel(loc),
      product_id: v.product_id, product_name: v.product_name, case_size: v.case_size,
      on_hand: v.on_hand, on_order: v.on_order, sold_14: v.recent,
      avg_daily: r.avgDaily, trend_pct: r.trendPct, days_cover: r.daysCover,
      stockout_date: r.daysCover !== null ? addDays(today, Math.floor(r.daysCover)) : null,
      needs_reorder: r.needsReorder, suggested_cases: r.suggestedCases,
    })
  }
  const sortOf = new Map(rows.map(r => [r.product_id, r.sort_order]))
  return out.sort((a, b) => (locOrder.get(a.location_id)! - locOrder.get(b.location_id)!) || ((sortOf.get(a.product_id) ?? 0) - (sortOf.get(b.product_id) ?? 0)))
}

/**
 * Creates or refreshes the partner's open order suggestion from current stock
 * and sales. Returns the open suggestion id, or null when nothing is needed.
 * Emails the partner when a new suggestion opens (notify = true).
 */
export async function refreshSuggestion(partner: Pick<Partner, 'id' | 'email' | 'contact_name' | 'status'>, notify = false): Promise<string | null> {
  if (partner.status !== 'approved') return null
  const sql = db()
  const cfg = await getForecastSettings()
  const [plan, catalog, active, open, recentDismissal] = await Promise.all([
    getStockPlan(partner.id, cfg),
    getPartnerCatalog(partner.id),
    getLocations(partner.id),
    one(sql<{ id: string }[]>`select id from sensare_partner_order_suggestions where partner_id = ${partner.id} and status = 'open'`),
    one(sql<{ id: string }[]>`select id from sensare_partner_order_suggestions
      where partner_id = ${partner.id} and status = 'dismissed' and decided_at > now() - interval '2 days' limit 1`),
  ])
  const orderable = new Set(catalog.map(c => c.id))
  const activeIds = new Set(active.map(l => l.id))
  const lines = plan.filter(p => p.suggested_cases > 0 && orderable.has(p.product_id) && activeIds.has(p.location_id))

  if (!lines.length) {
    if (open) await sql`update sensare_partner_order_suggestions set status = 'superseded', decided_at = now() where id = ${open.id}`
    return null
  }
  if (!open && recentDismissal) return null // respect a recent "not now"

  const id = await sql.begin(async tx => {
    let sid = open?.id
    if (sid) {
      await tx`update sensare_partner_order_suggestions
        set lead_time_days = ${cfg.leadTimeDays}, cover_days = ${cfg.coverDays}, safety_days = ${cfg.safetyDays}, generated_at = now()
        where id = ${sid}`
      await tx`delete from sensare_partner_order_suggestion_lines where suggestion_id = ${sid}`
    } else {
      const row = await one(tx<{ id: string }[]>`
        insert into sensare_partner_order_suggestions (partner_id, lead_time_days, cover_days, safety_days)
        values (${partner.id}, ${cfg.leadTimeDays}, ${cfg.coverDays}, ${cfg.safetyDays})
        on conflict (partner_id) where status = 'open' do nothing
        returning id`)
      if (!row) return null // a concurrent refresh opened one first
      sid = row.id
    }
    await tx`insert into sensare_partner_order_suggestion_lines ${tx(lines.map(l => ({
      suggestion_id: sid,
      location_id: l.location_id,
      product_id: l.product_id,
      suggested_cases: l.suggested_cases,
      case_size: l.case_size,
      on_hand: l.on_hand,
      on_order: l.on_order,
      avg_daily: Math.round(l.avg_daily * 1000) / 1000,
      trend_pct: l.trend_pct === null ? null : Math.round(l.trend_pct * 10) / 10,
      days_cover: l.days_cover === null ? null : Math.round(l.days_cover * 10) / 10,
      stockout_date: l.stockout_date,
    })))}`
    return sid
  })
  if (!id) return refreshSuggestion(partner, false)

  if (!open && notify) {
    const cases = lines.reduce((s, l) => s + l.suggested_cases, 0)
    await email.suggestionReady(partner, cases, new Set(lines.map(l => l.location_id)).size)
    await sql`update sensare_partner_order_suggestions set notified_at = now() where id = ${id}`
  }
  return id
}

/** Refreshes the open suggestion if it is missing or older than 12 hours. Never throws. */
export async function ensureFreshSuggestion(partner: Partner) {
  try {
    const row = await one(db()<{ generated_at: string }[]>`
      select generated_at from sensare_partner_order_suggestions where partner_id = ${partner.id} and status = 'open'`)
    if (!row || Date.now() - Date.parse(row.generated_at) > 12 * 3600_000) await refreshSuggestion(partner)
  } catch (e) {
    console.error('Suggestion refresh failed', e)
  }
}
