import 'server-only'
import { supabaseAdmin } from './supabase'
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
  const db = supabaseAdmin()
  let ordersQ = db.from('sensare_partner_orders')
    .select('*, sensare_partners(business_name), sensare_partner_order_items(case_qty)')
    .neq('status', 'cancelled')
    .gte('created_at', `${range.from}T00:00:00+08:00`)
    .lte('created_at', `${range.to}T23:59:59.999+08:00`)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (partnerId) ordersQ = ordersQ.eq('partner_id', partnerId)
  if (locationId) ordersQ = ordersQ.eq('location_id', locationId)

  // Outstanding balances are as of today, regardless of the date range.
  let openQ = db.from('sensare_partner_orders').select('partner_id, total_php, amount_paid_php, due_date, payment_status, status')
    .neq('status', 'cancelled').neq('payment_status', 'paid').limit(5000)
  if (partnerId) openQ = openQ.eq('partner_id', partnerId)
  if (locationId) openQ = openQ.eq('location_id', locationId)

  const [{ data: flow, error: flowErr }, { data: daily }, { data: products }, { data: partners }, { data: orders }, { data: open }] = await Promise.all([
    db.rpc('sensare_partner_report', { p_partner_id: partnerId, p_location_id: locationId, p_from: range.from, p_to: range.to }),
    db.rpc('sensare_partner_report_daily', { p_partner_id: partnerId, p_location_id: locationId, p_from: range.from, p_to: range.to }),
    db.from('sensare_products').select('id, name, sort_order').order('sort_order'),
    partnerId ? Promise.resolve({ data: [] as { id: string; business_name: string }[] }) : db.from('sensare_partners').select('id, business_name'),
    ordersQ,
    openQ,
  ])
  if (flowErr) console.error('Report RPC failed', flowErr)

  const productName = new Map((products ?? []).map(p => [p.id as string, p.name as string]))
  const productOrder = new Map((products ?? []).map((p, i) => [p.id as string, i]))
  const partnerName = new Map((partners ?? []).map(p => [p.id as string, p.business_name as string]))

  type Row = { partner_id: string; location_id: string; product_id: string; opening: number; received: number; sold: number; adjusted: number; closing: number; sales_value: number }
  const rows = ((flow ?? []) as Row[]).map(r => ({ ...r, sales_value: Number(r.sales_value) }))

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

  const orderList = ((orders ?? []) as (PartnerOrder & { sensare_partners: { business_name: string } | null; sensare_partner_order_items: { case_qty: number }[] })[])
    .map(o => ({ ...o, partner_name: o.sensare_partners?.business_name, cases: o.sensare_partner_order_items.reduce((s, i) => s + i.case_qty, 0) }))
  const openOrders = (open ?? []) as PartnerOrder[]

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
    const { data: locs } = await db.from('sensare_partner_locations').select('id, name').eq('partner_id', partnerId)
    const ln = new Map((locs ?? []).map(l => [l.id as string, l.name as string]))
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
    daily: ((daily ?? []) as { sale_date: string; units: number; sales_value: number }[]).map(d => ({ ...d, sales_value: Number(d.sales_value) })),
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
