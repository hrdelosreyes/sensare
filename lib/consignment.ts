import 'server-only'
import { supabaseAdmin } from './supabase'
import { addDays, manilaToday, type Partner, type Settlement } from './partner'

export const SETTLEMENT_REF_PREFIX = 'spc_'

export type SettlementLine = {
  order_item_id: string; order_id: string; order_number: string; location_id: string
  product_id: string; product_name: string; units: number; unit_price_php: number; amount_php: number
}

export type ConsignmentState = {
  hasConsignment: boolean
  nextFrom: string | null      // first unsettled day
  defaultTo: string | null     // nextFrom + period − 1, capped at today
  periodDays: number
  isDue: boolean               // a full period has passed since nextFrom
  lastSettlement: Settlement | null
  pendingOnline: boolean       // an online (HitPay) payment was started and not yet confirmed
}

const manilaDate = (ts: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(ts))

export async function getConsignmentState(partner: Pick<Partner, 'id' | 'consignment_period_days'>): Promise<ConsignmentState> {
  const db = supabaseAdmin()
  const periodDays = partner.consignment_period_days || 7
  // In-flight HitPay checkouts don't block a retry (the retry cancels them).
  const [{ data: last }, { data: firstDelivery }, { count: online }] = await Promise.all([
    db.from('sensare_partner_consignment_settlements').select('*').eq('partner_id', partner.id)
      .or('status.eq.confirmed,and(status.eq.pending,method.neq.hitpay)')
      .order('period_to', { ascending: false }).limit(1).maybeSingle(),
    db.from('sensare_partner_orders').select('delivered_at').eq('partner_id', partner.id)
      .eq('payment_terms', 'consignment').eq('status', 'delivered').order('delivered_at').limit(1).maybeSingle(),
    db.from('sensare_partner_consignment_settlements').select('id', { count: 'exact', head: true })
      .eq('partner_id', partner.id).eq('method', 'hitpay').eq('status', 'pending'),
  ])
  const pendingOnline = (online ?? 0) > 0
  const today = manilaToday()
  if (!firstDelivery?.delivered_at) {
    return { hasConsignment: false, nextFrom: null, defaultTo: null, periodDays, isDue: false, lastSettlement: (last as Settlement) ?? null, pendingOnline }
  }
  const nextFrom = last ? addDays(last.period_to, 1) : manilaDate(firstDelivery.delivered_at)
  const fullEnd = addDays(nextFrom, periodDays - 1)
  return {
    hasConsignment: true,
    nextFrom: nextFrom <= today ? nextFrom : null,
    defaultTo: nextFrom <= today ? (fullEnd < today ? fullEnd : today) : null,
    periodDays,
    isDue: fullEnd < today,
    lastSettlement: (last as Settlement) ?? null,
    pendingOnline,
  }
}

/** Cancels the partner's unfinished HitPay settlement checkouts before a new attempt. */
export async function cancelPendingOnlineSettlements(partnerId: string) {
  await supabaseAdmin().from('sensare_partner_consignment_settlements')
    .update({ status: 'failed' }).eq('partner_id', partnerId).eq('method', 'hitpay').eq('status', 'pending')
}

export async function previewSettlement(partnerId: string, from: string, to: string): Promise<SettlementLine[]> {
  const { data, error } = await supabaseAdmin().rpc('sensare_partner_consignment_preview', { p_partner_id: partnerId, p_from: from, p_to: to })
  if (error) console.error('Consignment preview failed', error)
  return ((data ?? []) as SettlementLine[]).map(l => ({ ...l, units: Number(l.units), unit_price_php: Number(l.unit_price_php), amount_php: Number(l.amount_php) }))
}

export async function createSettlement(args: {
  partnerId: string; from: string; to: string; method: string; status: 'pending' | 'confirmed'
  reference?: string | null; notes?: string | null; paidOn?: string | null; userId?: string | null
}): Promise<{ id?: string; error?: string }> {
  const { data, error } = await supabaseAdmin().rpc('sensare_partner_create_settlement', {
    p_partner_id: args.partnerId, p_from: args.from, p_to: args.to, p_method: args.method, p_status: args.status,
    p_reference: args.reference ?? null, p_notes: args.notes ?? null, p_paid_on: args.paidOn ?? null, p_user_id: args.userId ?? null,
  })
  if (error) {
    const m = error.message ?? ''
    return { error: /^(No consignment|This period|Period )/.test(m) ? m : 'Could not create the settlement.' }
  }
  return { id: data as string }
}
