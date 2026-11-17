import 'server-only'
import { db } from './db'
import { addDays, balance, isIsoDate, isOverdue, manilaToday, type PartnerOrder, type PaymentTerms } from './partner'

export type ReportRange = { from: string; to: string; preset: string }

export function parseRange(sp: { from?: string; to?: string; preset?: string }): ReportRange {
  const today = manilaToday()
  const preset = sp.preset ?? (sp.from || sp.to ? 'custom' : '30d')
  if (preset === 'custom' && isIsoDate(sp.from) && isIsoDate(sp.to)) {
    const [from, to] = sp.from! <= sp.to! ? [sp.from!, sp.to!] : [sp.to!, sp.from!]
    return { from, to, preset }
  }
  const month = today.slice(0, 7)
  switch (preset) {
    case '7d': return { from: addDays(today, -6), to: today, preset }
    case 'mtd': return { from: `${month}-01`, to: today, preset }
    case 'lastmonth': {
      const firstThis = `${month}-01`
      const lastPrev = addDays(firstThis, -1)
      return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev, preset }
    }
    case 'ytd': return { from: `${today.slice(0, 4)}-01-01`, to: today, preset }
    case '90d': return { from: addDays(today, -89), to: today, preset }
    default: return { from: addDays(today, -29), to: today, preset: '30d' }
  }
}

export const PRESETS: Record<string, string> = {
  '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', mtd: 'This month', lastmonth: 'Last month', ytd: 'Year to date',
}

export type ProductFlow = {
  partner_id: string; product_id: string; product_name: string; partner_name?: string
  opening: number; received: number; sold: number; adjusted: number; closing: number
  sales_value: number; sell_through: number | null
}

export type Report = {
  range: ReportRange
  products: ProductFlow[]          // aggregated by product (all partners in scope)
  locations: (ProductFlow & { location_name: string })[] // by branch (single-partner reports)
  partners: (ProductFlow & { order_value: number; outstanding: number; overdue: number })[] // by partner (admin)
  daily: { sale_date: string; units: number; sales_value: number }[]
  totals: { opening: number; received: number; sold: number; adjusted: number; closing: number; sales_value: number; sell_through: number | null }
  orders: {
    count: number; cases: number; value: number; paid: number; outstanding: number; overdue: number
    byTerms: Record<PaymentTerms, { count: number; value: number; outstanding: number }>
    list: (PartnerOrder & { partner_name?: string; cases: number })[]
  }
}

const sellThrough = (sold: number, opening: number, received: number) =>
  opening + received > 0 ? sold / (opening + received) : null

export async function buildReport(partnerId: string | null, range: ReportRange, locationId: string | null = null): Promise<Report> {
  const sql = db()
  const pf = partnerId ? sql`and o.partner_id = ${partnerId}` : sql``
  const lf = locationId ? sql`and o.location_id = ${locationId}` : sql``
  const [flow, daily, products, partners, orders, open] = await Promise.all([
    sql`select * from sensare_partner_report(${partnerId}::uuid, ${locationId}::uuid, ${range.from}::date, ${range.to}::date)`,
    sql`select * from sensare_partner_report_daily(${partnerId}::uuid, ${locationId}::uuid, ${range.from}::date, ${range.to}::date)`,
    sql<{ id: string; name: string }[]>`select id, name from sensare_products order by sort_order`,
    partnerId ? Promise.resolve([] as { id: string; business_name: string }[]) : sql<{ id: string; business_name: string }[]>`select id, business_name from sensare_partners`,
    sql<(PartnerOrder & { partner_name: string | null; cases: number })[]>`
      select o.*, p.business_name as partner_name,
        coalesce((select sum(case_qty) from sensare_partner_order_items i where i.order_id = o.id), 0)::int as cases
      from sensare_partner_orders o join sensare_partners p on p.id = o.partner_id
      where o.status <> 'cancelled' ${pf} ${lf}
        and o.created_at >= (${range.from}::date::timestamp at time zone 'Asia/Manila')
        and o.created_at < ((${range.to}::date + 1)::timestamp at time zone 'Asia/Manila')
      order by o.created_at desc limit 1000`,
    // Outstanding balances are as of today, regardless of the date range.
    sql<PartnerOrder[]>`select o.* from sensare_partner_orders o
      where o.status <> 'cancelled' and o.payment_status <> 'paid' ${pf} ${lf}`,
  ])

  const productName = new Map(products.map(p => [p.id, p.name]))
  const productOrder = new Map(products.map((p, i) => [p.id, i]))
  const partnerName = new Map(partners.map(p => [p.id, p.business_name]))

  type Row = { partner_id: string; location_id: string; product_id: string; opening: number; received: number; sold: number; adjusted: number; closing: number; sales_value: number }
  const rows = flow as unknown as Row[]

  const sum = (rs: Row[], key: string, name: string, extra: Partial<ProductFlow> = {}): ProductFlow => {
    const t = rs.reduce((a, r) => ({
      opening: a.opening + r.opening, received: a.received + r.received, sold: a.sold + r.sold,
      adjusted: a.adjusted + r.adjusted, closing: a.closing + r.closing, sales_value: a.sales_value + r.sales_value,
    }), { opening: 0, received: 0, sold: 0, adjusted: 0, closing: 0, sales_value: 0 })
    return { partner_id: rs[0]?.partner_id ?? '', product_id: key, product_name: name, ...t, sell_through: sellThrough(t.sold, t.opening, t.received), ...extra }
  }

  const group = <K extends string>(keyFn: (r: Row) => K) => {
    const m = new Map<K, Row[]>()
    for (const r of rows) m.set(keyFn(r), [...(m.get(keyFn(r)) ?? []), r])
    return m
  }

  const productRows = [...group(r => r.product_id).entries()]
    .map(([pid, rs]) => sum(rs, pid, productName.get(pid) ?? 'Unknown'))
    .sort((a, b) => (productOrder.get(a.product_id) ?? 99) - (productOrder.get(b.product_id) ?? 99))

  const orderList = orders.map(o => ({ ...o, partner_name: o.partner_name ?? undefined }))
  const openOrders = open

  const outstandingBy = new Map<string, { outstanding: number; overdue: number }>()
  for (const o of openOrders) {
    const v = outstandingBy.get(o.partner_id) ?? { outstanding: 0, overdue: 0 }
    v.outstanding += balance(o)
    if (isOverdue(o)) v.overdue += balance(o)
    outstandingBy.set(o.partner_id, v)
  }
  const orderValueBy = new Map<string, number>()
  for (const o of orderList) orderValueBy.set(o.partner_id, (orderValueBy.get(o.partner_id) ?? 0) + Number(o.total_php))

  const partnerIds = new Set([...rows.map(r => r.partner_id), ...orderValueBy.keys(), ...outstandingBy.keys()])
  const byPartner = group(r => r.partner_id)
  const partnerRows = partnerId ? [] : [...partnerIds].map(pid => ({
    ...sum(byPartner.get(pid) ?? [], pid, '', { partner_id: pid, partner_name: partnerName.get(pid) ?? 'Unknown' }),
    order_value: orderValueBy.get(pid) ?? 0,
    outstanding: outstandingBy.get(pid)?.outstanding ?? 0,
    overdue: outstandingBy.get(pid)?.overdue ?? 0,
  })).sort((a, b) => b.sales_value - a.sales_value || b.sold - a.sold)

  let locationRows: Report['locations'] = []
  if (partnerId) {
    const locs = await sql<{ id: string; name: string }[]>`select id, name from sensare_partner_locations where partner_id = ${partnerId}`
    const ln = new Map(locs.map(l => [l.id, l.name]))
    locationRows = [...group(r => r.location_id).entries()]
      .map(([lid, rs]) => ({ ...sum(rs, lid, ''), location_name: ln.get(lid) ?? 'Branch' }))
      .sort((a, b) => b.sold - a.sold)
  }

  const totals = sum(rows, '', '')
  const byTerms = { cod: { count: 0, value: 0, outstanding: 0 }, consignment: { count: 0, value: 0, outstanding: 0 }, net30: { count: 0, value: 0, outstanding: 0 } }
  for (const o of orderList) {
    byTerms[o.payment_terms].count++
    byTerms[o.payment_terms].value += Number(o.total_php)
    byTerms[o.payment_terms].outstanding += balance(o)
  }
  let outstanding = 0, overdue = 0
  for (const v of outstandingBy.values()) { outstanding += v.outstanding; overdue += v.overdue }

  return {
    range,
    products: productRows,
    locations: locationRows,
    partners: partnerRows,
    daily: daily as unknown as { sale_date: string; units: number; sales_value: number }[],
    totals: { opening: totals.opening, received: totals.received, sold: totals.sold, adjusted: totals.adjusted, closing: totals.closing, sales_value: totals.sales_value, sell_through: totals.sell_through },
    orders: {
      count: orderList.length,
      cases: orderList.reduce((s, o) => s + o.cases, 0),
      value: orderList.reduce((s, o) => s + Number(o.total_php), 0),
      paid: orderList.reduce((s, o) => s + Number(o.amount_paid_php), 0),
      outstanding, overdue, byTerms, list: orderList,
    },
  }
}

// ---- CSV -------------------------------------------------------------------

function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  // Guard against spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function reportCsv(report: Report, kind: string): { filename: string; csv: string } | null {
  const tag = `${report.range.from}_to_${report.range.to}`
  const pct = (v: number | null) => (v === null ? '' : (v * 100).toFixed(1))
  switch (kind) {
    case 'products':
      return {
        filename: `sensare-stock-and-sales-by-product_${tag}.csv`,
        csv: toCsv(['Product', 'Opening stock', 'Received', 'Sold', 'Adjusted', 'Closing stock', 'Sell-through %', 'Sales value (PHP)'],
          report.products.map(p => [p.product_name, p.opening, p.received, p.sold, p.adjusted, p.closing, pct(p.sell_through), p.sales_value.toFixed(2)])),
      }
    case 'daily':
      return {
        filename: `sensare-daily-sales_${tag}.csv`,
        csv: toCsv(['Date', 'Units sold', 'Sales value (PHP)'], report.daily.map(d => [d.sale_date, d.units, d.sales_value.toFixed(2)])),
      }
    case 'orders':
      return {
        filename: `sensare-orders_${tag}.csv`,
        csv: toCsv(['Order', 'Date', 'Partner', 'Status', 'Terms', 'Cases', 'Total (PHP)', 'Paid (PHP)', 'Balance (PHP)', 'Due date'],
          report.orders.list.map(o => [o.order_number, o.created_at.slice(0, 10), o.partner_name ?? '', o.status, o.payment_terms, o.cases,
            Number(o.total_php).toFixed(2), Number(o.amount_paid_php).toFixed(2), balance(o).toFixed(2), o.due_date ?? ''])),
      }
    case 'branches':
      return {
        filename: `sensare-sales-by-branch_${tag}.csv`,
        csv: toCsv(['Branch', 'Opening stock', 'Received', 'Sold', 'Adjusted', 'Closing stock', 'Sell-through %', 'Sales value (PHP)'],
          report.locations.map(p => [p.location_name, p.opening, p.received, p.sold, p.adjusted, p.closing, pct(p.sell_through), p.sales_value.toFixed(2)])),
      }
    case 'partners':
      return {
        filename: `sensare-partners-summary_${tag}.csv`,
        csv: toCsv(['Partner', 'Units sold', 'Sales value (PHP)', 'Sell-through %', 'Closing stock', 'Orders value (PHP)', 'Outstanding (PHP)', 'Overdue (PHP)'],
          report.partners.map(p => [p.partner_name, p.sold, p.sales_value.toFixed(2), pct(p.sell_through), p.closing, p.order_value.toFixed(2), p.outstanding.toFixed(2), p.overdue.toFixed(2)])),
      }
  }
  return null
}
