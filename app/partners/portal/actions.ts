'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db, dbMessage, one } from '@/lib/db'
import { requireApprovedPartner, getUser } from '@/lib/auth'
import { getLocations, getPartnerCatalog } from '@/lib/partner-data'
import { refreshSuggestion } from '@/lib/forecast'
import { createHitpayPayment, createHitpayRequest } from '@/lib/hitpay'
import { cancelPendingOnlineSettlements, createSettlement, getConsignmentState, SETTLEMENT_REF_PREFIX } from '@/lib/consignment'
import { email } from '@/lib/email'
import {
  ADJUSTMENT_REASONS, addDays, balance, isIsoDate, isPaymentTerms, locationAddress, manilaToday,
  type Location, type Partner, type PartnerOrder, type PaymentTerms,
} from '@/lib/partner'

export type FormState = { error?: string; ok?: string } | undefined

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

async function getOwnOrder(partnerId: string, orderId: string): Promise<PartnerOrder | null> {
  if (!isUuid(orderId)) return null
  return one(db()<PartnerOrder[]>`select * from sensare_partner_orders where id = ${orderId} and partner_id = ${partnerId}`)
}

// Messages raised by our SQL functions are user-facing; hide anything else.
function friendly(e: unknown, fallback: string) {
  const m = dbMessage(e)
  return /^(Not enough|Only |Order |Adjustment|Units|Sale date|Quantity|Sales on|Unknown location|No consignment|This period|Period )/.test(m) ? m : fallback
}

// Refresh the open suggestion after a user action; never fail the action.
async function refreshQuietly(partner: Partner) {
  try { await refreshSuggestion(partner) } catch (e) { console.error('Suggestion refresh failed', e) }
}

// ---------------------------------------------------------------- Orders

type Line = { location_id: string; product_id: string; cases: number }

function deliveryAddress(l: Location) {
  return [l.name, locationAddress(l), [l.contact_name, l.phone].filter(Boolean).join(' · '), l.delivery_notes]
    .filter(Boolean).join('\n')
}

/** Places one order per delivery location in a single transaction; all share an order_group_id. */
async function placeOrders(partner: Partner, lines: Line[], terms: PaymentTerms, notes: string | null, suggestionId: string | null) {
  const user = await getUser()
  const [catalog, locations] = await Promise.all([getPartnerCatalog(partner.id), getLocations(partner.id)])
  const prod = new Map(catalog.map(c => [c.id, c]))
  const loc = new Map(locations.map(l => [l.id, l]))

  const valid = lines.filter(l => l.cases > 0)
  if (!valid.length) return { error: 'Add at least one case to your order.' }
  if (valid.some(l => !Number.isInteger(l.cases) || l.cases > 999)) return { error: 'Please enter a valid number of cases (max 999).' }
  if (valid.some(l => !prod.has(l.product_id))) return { error: 'One of the products is no longer available to order.' }
  if (valid.some(l => !loc.has(l.location_id))) return { error: 'One of the branches is no longer active.' }

  const byLocation = new Map<string, Line[]>()
  for (const l of valid) byLocation.set(l.location_id, [...(byLocation.get(l.location_id) ?? []), l])

  let created: PartnerOrder[]
  let groupId: string
  try {
    ;({ created, groupId } = await db().begin(async tx => {
      const [{ id: gid }] = await tx<{ id: string }[]>`select gen_random_uuid() as id`
      const out: PartnerOrder[] = []
      for (const [locationId, ls] of byLocation) {
        const items = ls.map(l => {
          const p = prod.get(l.product_id)!
          return {
            product_id: p.id, product_name: p.name, case_qty: l.cases, case_size: p.case_size,
            case_price_php: p.effective_case_price!, line_total_php: Math.round(l.cases * p.effective_case_price! * 100) / 100,
          }
        })
        const subtotal = Math.round(items.reduce((s, i) => s + i.line_total_php, 0) * 100) / 100
        const [order] = await tx<PartnerOrder[]>`insert into sensare_partner_orders ${tx({
          partner_id: partner.id, location_id: locationId, order_group_id: gid, suggestion_id: suggestionId,
          payment_terms: terms, subtotal_php: subtotal, shipping_php: 0, total_php: subtotal,
          shipping_address: deliveryAddress(loc.get(locationId)!), partner_notes: notes, created_by: user?.id ?? null,
        })} returning *`
        await tx`insert into sensare_partner_order_items ${tx(items.map(i => ({ ...i, order_id: order.id })))}`
        out.push(order)
      }
      if (suggestionId) {
        await tx`update sensare_partner_order_suggestions
          set status = 'approved', decided_at = now(), decided_by = ${user?.id ?? null}, order_group_id = ${gid}
          where id = ${suggestionId} and partner_id = ${partner.id} and status = 'open'`
      }
      return { created: out, groupId: gid }
    }))
  } catch (e) {
    console.error('Order placement failed', e)
    return { error: 'We could not place your order. Please try again.' }
  }

  for (const o of created) await email.orderPlaced(o, partner)
  await refreshQuietly(partner)
  revalidatePath('/partners/portal', 'layout')
  return { groupId, orders: created }
}

export async function placeOrderAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const terms = String(fd.get('payment_terms') || partner.default_payment_terms)
  if (!isPaymentTerms(terms)) return { error: 'Please choose payment terms.' }

  const lines: Line[] = []
  for (const [k, v] of fd.entries()) {
    const m = /^qty_([0-9a-f-]{36})_([0-9a-f-]{36})$/.exec(k)
    if (m) lines.push({ location_id: m[1], product_id: m[2], cases: Math.floor(Number(v) || 0) })
  }
  const sid = str(fd, 'suggestion_id', 64)
  const res = await placeOrders(partner, lines, terms, str(fd, 'partner_notes', 1000) || null, isUuid(sid) ? sid : null)
  if ('error' in res) return { error: res.error }
  redirect(res.orders.length === 1 ? `/partners/portal/orders/${res.orders[0].id}?placed=1` : `/partners/portal/orders?placed=${res.groupId}`)
}

export async function cancelOwnOrderAction(fd: FormData) {
  const partner = await requireApprovedPartner()
  const order = await getOwnOrder(partner.id, String(fd.get('order_id')))
  if (!order || order.status !== 'submitted') return
  await db()`select sensare_partner_cancel_order(${order.id}::uuid)`
  await refreshQuietly(partner)
  revalidatePath('/partners/portal', 'layout')
}

export async function confirmReceivedAction(fd: FormData) {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const order = await getOwnOrder(partner.id, String(fd.get('order_id')))
  if (!order || order.status !== 'shipped') return
  try {
    await db()`select sensare_partner_deliver_order(${order.id}::uuid, ${user?.id ?? null}::uuid)`
  } catch (e) { console.error('Confirm received failed', e) }
  revalidatePath('/partners/portal', 'layout')
}

export async function payOnlineAction(orderId: string): Promise<{ url?: string; error?: string }> {
  const partner = await requireApprovedPartner()
  const order = await getOwnOrder(partner.id, orderId)
  if (!order) return { error: 'Order not found.' }
  if (order.status === 'submitted') return { error: 'Online payment opens once we confirm your order.' }
  if (order.status === 'cancelled') return { error: 'This order was cancelled.' }
  const amount = balance(order)
  if (amount <= 0) return { error: 'This order is already paid.' }
  try {
    const url = await createHitpayPayment({ order, partner, amount, returnPath: `/partners/portal/orders/${order.id}?paid=1` })
    return { url }
  } catch (e) {
    console.error('HitPay create failed', e)
    return { error: 'Online payment is unavailable right now. Please try again or pay by bank transfer.' }
  }
}

export async function reportBankTransferAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const order = await getOwnOrder(partner.id, String(fd.get('order_id')))
  if (!order || order.status === 'cancelled') return { error: 'Order not found.' }
  const amount = Math.round(Number(fd.get('amount')) * 100) / 100
  const reference = str(fd, 'reference', 100)
  const paidOn = str(fd, 'paid_on', 10)
  if (!(amount > 0)) return { error: 'Enter the amount you transferred.' }
  if (amount > balance(order) + 0.01) return { error: `Amount is more than the balance due.` }
  if (!reference) return { error: 'Enter the bank reference number.' }
  if (paidOn && !isIsoDate(paidOn)) return { error: 'Enter a valid date.' }

  try {
    await db()`insert into sensare_partner_payments ${db()({
      order_id: order.id, partner_id: partner.id, amount_php: amount, method: 'bank_transfer',
      status: 'pending', reference, paid_on: paidOn || manilaToday(),
      notes: str(fd, 'notes', 500) || null, created_by: user?.id ?? null,
    })}`
  } catch (e) {
    console.error('Bank transfer insert failed', e)
    return { error: 'Could not record the payment. Please try again.' }
  }
  await email.paymentReported(order, partner, amount, reference)
  revalidatePath(`/partners/portal/orders/${order.id}`)
  return { ok: 'Thanks! We’ll verify the transfer and update your balance.' }
}

// ---------------------------------------------------------------- Suggested orders

export async function approveSuggestionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const sid = str(fd, 'suggestion_id', 64)
  const lines = isUuid(sid) ? await db()<{ location_id: string; product_id: string; suggested_cases: number }[]>`
    select l.location_id, l.product_id, l.suggested_cases
    from sensare_partner_order_suggestion_lines l
    join sensare_partner_order_suggestions s on s.id = l.suggestion_id
    where s.id = ${sid} and s.partner_id = ${partner.id} and s.status = 'open'` : []
  if (!lines.length) return { error: 'This suggestion is no longer open — it may have been updated. Please review it again.' }
  const terms = String(fd.get('payment_terms') || partner.default_payment_terms)
  if (!isPaymentTerms(terms)) return { error: 'Please choose payment terms.' }
  const res = await placeOrders(partner,
    lines.map(l => ({ location_id: l.location_id, product_id: l.product_id, cases: l.suggested_cases })),
    terms, 'Approved from suggested order', sid)
  if ('error' in res) return { error: res.error }
  redirect(res.orders.length === 1 ? `/partners/portal/orders/${res.orders[0].id}?placed=1` : `/partners/portal/orders?placed=${res.groupId}`)
}

export async function dismissSuggestionAction(fd: FormData) {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const sid = str(fd, 'suggestion_id', 64)
  if (!isUuid(sid)) return
  await db()`update sensare_partner_order_suggestions
    set status = 'dismissed', decided_at = now(), decided_by = ${user?.id ?? null}
    where id = ${sid} and partner_id = ${partner.id} and status = 'open'`
  revalidatePath('/partners/portal', 'layout')
}

export async function refreshSuggestionAction() {
  const partner = await requireApprovedPartner()
  // An explicit refresh overrides a recent dismissal.
  await db()`update sensare_partner_order_suggestions set status = 'superseded'
    where partner_id = ${partner.id} and status = 'dismissed' and decided_at > now() - interval '2 days'`
  await refreshSuggestion(partner)
  revalidatePath('/partners/portal', 'layout')
}

// ---------------------------------------------------------------- Sales

export async function saveSalesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const date = str(fd, 'sale_date', 10)
  const locationId = str(fd, 'location_id', 64)
  const today = manilaToday()
  if (!isIsoDate(date)) return { error: 'Choose a valid date.' }
  if (date > today) return { error: 'You can’t record sales for a future date.' }
  if (date < addDays(today, -90)) return { error: 'Sales older than 90 days can’t be changed here — please contact us.' }
  if (!(await getLocations(partner.id)).some(l => l.id === locationId)) return { error: 'Choose a branch.' }

  const errors: string[] = []
  let saved = 0
  for (const pid of fd.getAll('product_id').map(String).filter(isUuid)) {
    const raw = String(fd.get(`units_${pid}`) ?? '').trim()
    const existed = fd.get(`existing_${pid}`) === '1'
    if (raw === '' && !existed) continue
    const units = raw === '' ? 0 : Math.floor(Number(raw))
    if (!Number.isFinite(units) || units < 0 || units > 100000) { errors.push('Invalid quantity entered.'); continue }
    const priceRaw = String(fd.get(`price_${pid}`) ?? '').trim()
    const price = priceRaw === '' ? null : Number(priceRaw)
    if (price !== null && (!Number.isFinite(price) || price < 0)) { errors.push('Invalid selling price.'); continue }
    try {
      await db()`select sensare_partner_record_sale(
        ${partner.id}::uuid, ${locationId}::uuid, ${pid}::uuid, ${date}::date,
        ${units}::int, ${price}::numeric, ${str(fd, 'notes', 500) || null}::text, ${user?.id ?? null}::uuid)`
      saved++
    } catch (e) {
      errors.push(friendly(e, 'Could not save one of the entries.'))
    }
  }
  if (saved) await refreshQuietly(partner)
  revalidatePath('/partners/portal', 'layout')
  if (errors.length) return { error: [...new Set(errors)].join(' ') }
  return { ok: saved ? 'Sales saved and inventory updated.' : 'Nothing to save — enter units sold.' }
}

// ---------------------------------------------------------------- Inventory

export async function adjustInventoryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const [locationId, productId] = str(fd, 'stock_key', 80).split('|')
  const qty = Math.floor(Number(fd.get('qty')))
  const reason = str(fd, 'reason', 50)
  if (!isUuid(locationId ?? '') || !isUuid(productId ?? '')) return { error: 'Choose a product.' }
  if (!(qty > 0)) return { error: 'Enter the number of units to remove.' }
  if (!(reason in ADJUSTMENT_REASONS)) return { error: 'Choose a reason.' }
  const expiry = str(fd, 'expiry_date', 10)

  // Partners can only remove stock; increases come from deliveries or admin.
  try {
    await db()`select sensare_partner_adjust_inventory(
      ${partner.id}::uuid, ${locationId}::uuid, ${productId}::uuid, ${-qty}::int, ${reason}::text,
      ${str(fd, 'notes', 500) || null}::text, ${str(fd, 'batch_code', 50) || null}::text,
      ${isIsoDate(expiry) ? expiry : null}::date, ${user?.id ?? null}::uuid)`
  } catch (e) {
    return { error: friendly(e, 'Could not save the adjustment.') }
  }
  await refreshQuietly(partner)
  revalidatePath('/partners/portal', 'layout')
  return { ok: 'Inventory updated.' }
}

// ---------------------------------------------------------------- Branches

export async function saveLocationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const id = str(fd, 'location_id', 64)
  const row = {
    name: str(fd, 'name', 100),
    contact_name: str(fd, 'contact_name', 200) || null,
    phone: str(fd, 'phone', 50) || null,
    address: str(fd, 'address', 300) || null,
    city: str(fd, 'city', 100) || null,
    province: str(fd, 'province', 100) || null,
    delivery_notes: str(fd, 'delivery_notes', 500) || null,
  }
  if (!row.name) return { error: 'Give the branch a name.' }
  if (!row.address || !row.city) return { error: 'Address and city are required for deliveries.' }
  try {
    if (id) {
      if (!isUuid(id)) return { error: 'Branch not found.' }
      await db()`update sensare_partner_locations set ${db()(row)}, updated_at = now() where id = ${id} and partner_id = ${partner.id}`
    } else {
      await db()`insert into sensare_partner_locations ${db()({ ...row, partner_id: partner.id })}`
    }
  } catch (e) {
    console.error('Save location failed', e)
    return { error: 'Could not save the branch.' }
  }
  revalidatePath('/partners/portal', 'layout')
  return { ok: id ? 'Branch updated.' : 'Branch added.' }
}

export async function setDefaultLocationAction(fd: FormData) {
  const partner = await requireApprovedPartner()
  const id = str(fd, 'location_id', 64)
  if (!isUuid(id)) return
  await db().begin(async tx => {
    const [loc] = await tx`select is_active from sensare_partner_locations where id = ${id} and partner_id = ${partner.id}`
    if (!loc?.is_active) return
    await tx`update sensare_partner_locations set is_default = false where partner_id = ${partner.id} and is_default`
    await tx`update sensare_partner_locations set is_default = true where id = ${id}`
  })
  revalidatePath('/partners/portal', 'layout')
}

export async function toggleLocationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const id = str(fd, 'location_id', 64)
  const active = fd.get('active') === '1'
  const sql = db()
  const loc = isUuid(id) ? await one(sql<Location[]>`select * from sensare_partner_locations where id = ${id} and partner_id = ${partner.id}`) : null
  if (!loc) return { error: 'Branch not found.' }
  if (!active) {
    if (loc.is_default) return { error: 'Make another branch your default before closing this one.' }
    const [{ stock, open }] = await sql<{ stock: number; open: number }[]>`
      select coalesce((select sum(on_hand) filter (where on_hand > 0) from sensare_partner_stock where location_id = ${id}), 0)::int as stock,
             (select count(*) from sensare_partner_orders where location_id = ${id} and status in ('submitted', 'confirmed', 'shipped'))::int as open`
    if (stock > 0) return { error: 'This branch still has stock. Record its sales or returns first.' }
    if (open > 0) return { error: 'This branch has orders on the way.' }
  }
  await sql`update sensare_partner_locations set is_active = ${active}, updated_at = now() where id = ${id}`
  revalidatePath('/partners/portal', 'layout')
  return { ok: active ? 'Branch reopened.' : 'Branch closed.' }
}

// ---------------------------------------------------------------- Consignment

async function validateSettlementPeriod(partner: Partner, to: string) {
  await cancelPendingOnlineSettlements(partner.id)
  const state = await getConsignmentState(partner)
  if (!state.nextFrom) return { error: 'There is nothing to settle yet.' }
  if (!isIsoDate(to) || to < state.nextFrom || to > manilaToday()) return { error: 'Choose a valid end date for the period.' }
  return { from: state.nextFrom, to }
}

export async function payConsignmentOnlineAction(to: string): Promise<{ url?: string; error?: string }> {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const period = await validateSettlementPeriod(partner, to)
  if ('error' in period) return { error: period.error }
  const reference = `${SETTLEMENT_REF_PREFIX}${partner.id.slice(0, 8)}_${Date.now()}`
  const res = await createSettlement({ partnerId: partner.id, from: period.from, to: period.to, method: 'hitpay', status: 'pending', reference, userId: user?.id })
  if (res.error) return { error: res.error }
  const fail = () => db()`update sensare_partner_consignment_settlements set status = 'failed' where id = ${res.id!}`
  if (!res.amount || res.amount <= 0) {
    await fail()
    return { error: 'These consignment orders are already fully paid.' }
  }
  try {
    const hitpay = await createHitpayRequest({
      reference, amount: res.amount, partner,
      purpose: `Sensarè consignment ${period.from} to ${period.to}`,
      returnPath: '/partners/portal/consignment?paid=1',
    })
    await db()`update sensare_partner_consignment_settlements set hitpay_payment_id = ${hitpay.id} where id = ${res.id!}`
    return { url: hitpay.url }
  } catch (e) {
    console.error('HitPay settlement failed', e)
    await fail()
    return { error: 'Online payment is unavailable right now. Please try again or pay by bank transfer.' }
  }
}

export async function reportConsignmentTransferAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const period = await validateSettlementPeriod(partner, str(fd, 'period_to', 10))
  if ('error' in period) return { error: period.error }
  const reference = str(fd, 'reference', 100)
  const paidOn = str(fd, 'paid_on', 10)
  if (!reference) return { error: 'Enter the bank reference number.' }
  const res = await createSettlement({
    partnerId: partner.id, from: period.from, to: period.to, method: 'bank_transfer', status: 'pending',
    reference, notes: str(fd, 'notes', 500) || null, paidOn: isIsoDate(paidOn) ? paidOn : manilaToday(), userId: user?.id,
  })
  if (res.error) return { error: res.error }
  await email.settlementReported(partner, res.amount ?? 0, reference, period.from, period.to)
  revalidatePath('/partners/portal', 'layout')
  return { ok: 'Thanks! We’ll verify your transfer and update your consignment balance.' }
}

// ---------------------------------------------------------------- Account

export async function updateAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const contact_name = str(fd, 'contact_name', 200)
  const phone = str(fd, 'phone', 50)
  if (!contact_name || !phone) return { error: 'Contact person and phone are required.' }
  await db()`update sensare_partners set ${db()({
    contact_name, phone,
    address: str(fd, 'address', 300) || null,
    city: str(fd, 'city', 100) || partner.city,
    province: str(fd, 'province', 100) || null,
    sales_channels: str(fd, 'sales_channels', 500) || null,
  })}, updated_at = now() where id = ${partner.id}`
  revalidatePath('/partners/portal', 'layout')
  return { ok: 'Details saved.' }
}
