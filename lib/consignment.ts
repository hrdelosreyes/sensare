import 'server-only'
import { db, dbMessage, one } from './db'
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

export async function getConsignmentState(partner: Pick<Partner, 'id' | 'consignment_period_days'>): Promise<ConsignmentState> {
  const sql = db()
  const periodDays = partner.consignment_period_days || 7
  // In-flight HitPay checkouts don't block a retry (the retry cancels them).
  const [last, first, online] = await Promise.all([
    one(sql<Settlement[]>`
      select * from sensare_partner_consignment_settlements
      where partner_id = ${partner.id} and (status = 'confirmed' or (status = 'pending' and method <> 'hitpay'))
      order by period_to desc limit 1`),
    one(sql<{ d: string | null }[]>`
      select min((delivered_at at time zone 'Asia/Manila')::date) as d from sensare_partner_orders
      where partner_id = ${partner.id} and payment_terms = 'consignment' and status = 'delivered'`),
    one(sql<{ n: number }[]>`
      select count(*)::int as n from sensare_partner_consignment_settlements
      where partner_id = ${partner.id} and method = 'hitpay' and status = 'pending'`),
  ])
  const pendingOnline = (online?.n ?? 0) > 0
  const today = manilaToday()
  if (!first?.d) {
    return { hasConsignment: false, nextFrom: null, defaultTo: null, periodDays, isDue: false, lastSettlement: last, pendingOnline }
  }
  const nextFrom = last ? addDays(last.period_to, 1) : first.d
  const fullEnd = addDays(nextFrom, periodDays - 1)
  return {
    hasConsignment: true,
    nextFrom: nextFrom <= today ? nextFrom : null,
    defaultTo: nextFrom <= today ? (fullEnd < today ? fullEnd : today) : null,
    periodDays,
    isDue: fullEnd < today,
    lastSettlement: last,
    pendingOnline,
  }
}

/** Cancels the partner's unfinished HitPay settlement checkouts before a new attempt. */
export async function cancelPendingOnlineSettlements(partnerId: string) {
  await db()`update sensare_partner_consignment_settlements set status = 'failed'
    where partner_id = ${partnerId} and method = 'hitpay' and status = 'pending'`
}

export async function previewSettlement(partnerId: string, from: string, to: string): Promise<SettlementLine[]> {
  return db()<SettlementLine[]>`select * from sensare_partner_consignment_preview(${partnerId}::uuid, ${from}::date, ${to}::date)`
}

export async function createSettlement(args: {
  partnerId: string; from: string; to: string; method: string; status: 'pending' | 'confirmed'
  reference?: string | null; notes?: string | null; paidOn?: string | null; userId?: string | null
}): Promise<{ id?: string; amount?: number; error?: string }> {
  try {
    const row = await one(db()<{ id: string }[]>`
      select sensare_partner_create_settlement(
        ${args.partnerId}::uuid, ${args.from}::date, ${args.to}::date, ${args.method}::text, ${args.status}::text,
        ${args.reference ?? null}::text, ${args.notes ?? null}::text, ${args.paidOn ?? null}::date, ${args.userId ?? null}::uuid
      ) as id`)
    const st = await one(db()<{ amount_php: number }[]>`select amount_php from sensare_partner_consignment_settlements where id = ${row!.id}`)
    return { id: row!.id, amount: st?.amount_php ?? 0 }
  } catch (e) {
    const m = dbMessage(e)
    return { error: /^(No consignment|This period|Period )/.test(m) ? m : 'Could not create the settlement.' }
  }
}
