'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
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

async function getOwnOrder(partnerId: string, orderId: string): Promise<PartnerOrder | null> {
  const { data } = await supabaseAdmin()
    .from('sensare_partner_orders').select('*').eq('id', orderId).eq('partner_id', partnerId).maybeSingle()
  return (data as PartnerOrder) ?? null
}

function dbError(e: { message?: string } | null | undefined, fallback: string) {
  // Messages raised by our SQL functions are user-facing; hide anything else.
  const m = e?.message ?? ''
  return /^(Not enough|Only |Order |Adjustment|Units|Sale date|Quantity|Sales on|Unknown location|No consignment|This period|Period )/.test(m) ? m : fallback
}

// Refresh the open suggestion in the background of a user action; never fail the action.
async function refreshQuietly(partner: Partner) {
  try { await refreshSuggestion(partner) } catch (e) { console.error('Suggestion refresh failed', e) }
}

// ---------------------------------------------------------------- Orders

type Line = { location_id: string; product_id: string; cases: number }

function deliveryAddress(l: Location) {
  return [l.name, locationAddress(l), [l.contact_name, l.phone].filter(Boolean).join(' · '), l.delivery_notes]
    .filter(Boolean).join('\n')
}

/** Places one order per delivery location; all share an order_group_id. */
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

  const db = supabaseAdmin()
  const groupId = randomUUID()
  const created: PartnerOrder[] = []
  for (const [locationId, ls] of byLocation) {
    const items = ls.map(l => {
      const p = prod.get(l.product_id)!
      return {
        product_id: p.id, product_name: p.name, case_qty: l.cases, case_size: p.case_size,
        case_price_php: p.effective_case_price!, line_total_php: Math.round(l.cases * p.effective_case_price! * 100) / 100,
      }
    })
    const subtotal = items.reduce((s, i) => s + i.line_total_php, 0)
    const { data: order, error } = await db.from('sensare_partner_orders').insert({
      partner_id: partner.id, location_id: locationId, order_group_id: groupId, suggestion_id: suggestionId,
      payment_terms: terms, subtotal_php: subtotal, shipping_php: 0, total_php: subtotal,
      shipping_address: deliveryAddress(loc.get(locationId)!), partner_notes: notes, created_by: user?.id ?? null,
    }).select('*').single()
    const itemErr = order ? (await db.from('sensare_partner_order_items').insert(items.map(i => ({ ...i, order_id: order.id })))).error : null
    if (error || !order || itemErr) {
      console.error('Order insert failed', error ?? itemErr)
      // Roll back this request's orders so nothing is half-placed.
      await db.from('sensare_partner_orders').delete().eq('order_group_id', groupId)
      return { error: 'We could not place your order. Please try again.' }
    }
    created.push(order as PartnerOrder)
  }

  if (suggestionId) {
    await db.from('sensare_partner_order_suggestions').update({
      status: 'approved', decided_at: new Date().toISOString(), decided_by: user?.id ?? null, order_group_id: groupId,
    }).eq('id', suggestionId).eq('partner_id', partner.id)
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
  const suggestionId = str(fd, 'suggestion_id', 64) || null
  const res = await placeOrders(partner, lines, terms, str(fd, 'partner_notes', 1000) || null, suggestionId)
  if ('error' in res) return { error: res.error }
  redirect(res.orders.length === 1 ? `/partners/portal/orders/${res.orders[0].id}?placed=1` : `/partners/portal/orders?placed=${res.groupId}`)
}

export async function cancelOwnOrderAction(fd: FormData) {
  const partner = await requireApprovedPartner()
  const order = await getOwnOrder(partner.id, String(fd.get('order_id')))
  if (!order || order.status !== 'submitted') return
  await supabaseAdmin().rpc('sensare_partner_cancel_order', { p_order_id: order.id })
  await refreshQuietly(partner)
  revalidatePath('/partners/portal', 'layout')
}

export async function confirmReceivedAction(fd: FormData) {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const order = await getOwnOrder(partner.id, String(fd.get('order_id')))
  if (!order || order.status !== 'shipped') return
  const { error } = await supabaseAdmin().rpc('sensare_partner_deliver_order', { p_order_id: order.id, p_user_id: user?.id ?? null })
  if (error) console.error('Confirm received failed', error)
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

  const { error } = await supabaseAdmin().from('sensare_partner_payments').insert({
    order_id: order.id, partner_id: partner.id, amount_php: amount, method: 'bank_transfer',
    status: 'pending', reference, paid_on: paidOn || manilaToday(),
    notes: str(fd, 'notes', 500) || null, created_by: user?.id ?? null,
  })
  if (error) return { error: 'Could not record the payment. Please try again.' }
  await email.paymentReported(order, partner, amount, reference)
  revalidatePath(`/partners/portal/orders/${order.id}`)
  return { ok: 'Thanks! We’ll verify the transfer and update your balance.' }
}

// ---------------------------------------------------------------- Suggested orders

async function getOpenSuggestion(partnerId: string, id: string) {
  const { data } = await supabaseAdmin().from('sensare_partner_order_suggestions')
    .select('*, sensare_partner_order_suggestion_lines(*)').eq('id', id).eq('partner_id', partnerId).eq('status', 'open').maybeSingle()
  return data as { id: string; sensare_partner_order_suggestion_lines: { location_id: string; product_id: string; suggested_cases: number }[] } | null
}

export async function approveSuggestionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const s = await getOpenSuggestion(partner.id, str(fd, 'suggestion_id', 64))
  if (!s) return { error: 'This suggestion is no longer open — it may have been updated. Please review it again.' }
  const terms = String(fd.get('payment_terms') || partner.default_payment_terms)
  if (!isPaymentTerms(terms)) return { error: 'Please choose payment terms.' }
  const res = await placeOrders(partner,
    s.sensare_partner_order_suggestion_lines.map(l => ({ location_id: l.location_id, product_id: l.product_id, cases: l.suggested_cases })),
    terms, 'Approved from suggested order', s.id)
  if ('error' in res) return { error: res.error }
  redirect(res.orders.length === 1 ? `/partners/portal/orders/${res.orders[0].id}?placed=1` : `/partners/portal/orders?placed=${res.groupId}`)
}

export async function dismissSuggestionAction(fd: FormData) {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  await supabaseAdmin().from('sensare_partner_order_suggestions')
    .update({ status: 'dismissed', decided_at: new Date().toISOString(), decided_by: user?.id ?? null })
    .eq('id', str(fd, 'suggestion_id', 64)).eq('partner_id', partner.id).eq('status', 'open')
  revalidatePath('/partners/portal', 'layout')
}

export async function refreshSuggestionAction() {
  const partner = await requireApprovedPartner()
  // An explicit refresh overrides a recent dismissal.
  await supabaseAdmin().from('sensare_partner_order_suggestions')
    .update({ status: 'superseded' }).eq('partner_id', partner.id).eq('status', 'dismissed')
    .gte('decided_at', new Date(Date.now() - 2 * 86400000).toISOString())
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

  const productIds = fd.getAll('product_id').map(String)
  const errors: string[] = []
  let saved = 0
  for (const pid of productIds) {
    const raw = String(fd.get(`units_${pid}`) ?? '').trim()
    const existed = fd.get(`existing_${pid}`) === '1'
    if (raw === '' && !existed) continue
    const units = raw === '' ? 0 : Math.floor(Number(raw))
    if (!Number.isFinite(units) || units < 0 || units > 100000) { errors.push('Invalid quantity entered.'); continue }
    const priceRaw = String(fd.get(`price_${pid}`) ?? '').trim()
    const price = priceRaw === '' ? null : Number(priceRaw)
    if (price !== null && (!Number.isFinite(price) || price < 0)) { errors.push('Invalid selling price.'); continue }
    const { error } = await supabaseAdmin().rpc('sensare_partner_record_sale', {
      p_partner_id: partner.id, p_location_id: locationId, p_product_id: pid, p_sale_date: date,
      p_units: units, p_unit_price: price, p_notes: str(fd, 'notes', 500) || null, p_user_id: user?.id ?? null,
    })
    if (error) errors.push(dbError(error, 'Could not save one of the entries.'))
    else saved++
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
  if (!locationId || !productId) return { error: 'Choose a product.' }
  if (!(qty > 0)) return { error: 'Enter the number of units to remove.' }
  if (!(reason in ADJUSTMENT_REASONS)) return { error: 'Choose a reason.' }
  const expiry = str(fd, 'expiry_date', 10)

  // Partners can only remove stock; increases come from deliveries or admin.
  const { error } = await supabaseAdmin().rpc('sensare_partner_adjust_inventory', {
    p_partner_id: partner.id, p_location_id: locationId, p_product_id: productId, p_qty_change: -qty, p_reason: reason,
    p_notes: str(fd, 'notes', 500) || null, p_batch: str(fd, 'batch_code', 50) || null,
    p_expiry: isIsoDate(expiry) ? expiry : null, p_user_id: user?.id ?? null,
  })
  if (error) return { error: dbError(error, 'Could not save the adjustment.') }
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
    updated_at: new Date().toISOString(),
  }
  if (!row.name) return { error: 'Give the branch a name.' }
  if (!row.address || !row.city) return { error: 'Address and city are required for deliveries.' }
  const db = supabaseAdmin()
  const { error } = id
    ? await db.from('sensare_partner_locations').update(row).eq('id', id).eq('partner_id', partner.id)
    : await db.from('sensare_partner_locations').insert({ ...row, partner_id: partner.id })
  if (error) return { error: 'Could not save the branch.' }
  revalidatePath('/partners/portal', 'layout')
  return { ok: id ? 'Branch updated.' : 'Branch added.' }
}

export async function setDefaultLocationAction(fd: FormData) {
  const partner = await requireApprovedPartner()
  const id = str(fd, 'location_id', 64)
  const db = supabaseAdmin()
  const { data: loc } = await db.from('sensare_partner_locations').select('id, is_active').eq('id', id).eq('partner_id', partner.id).maybeSingle()
  if (!loc?.is_active) return
  await db.from('sensare_partner_locations').update({ is_default: false }).eq('partner_id', partner.id).eq('is_default', true)
  await db.from('sensare_partner_locations').update({ is_default: true }).eq('id', id)
  revalidatePath('/partners/portal', 'layout')
}

export async function toggleLocationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const id = str(fd, 'location_id', 64)
  const active = fd.get('active') === '1'
  const db = supabaseAdmin()
  const { data: loc } = await db.from('sensare_partner_locations').select('*').eq('id', id).eq('partner_id', partner.id).maybeSingle()
  if (!loc) return { error: 'Branch not found.' }
  if (!active) {
    if (loc.is_default) return { error: 'Make another branch your default before closing this one.' }
    const [{ data: stock }, { count }] = await Promise.all([
      db.from('sensare_partner_stock').select('on_hand').eq('location_id', id),
      db.from('sensare_partner_orders').select('id', { count: 'exact', head: true }).eq('location_id', id).in('status', ['submitted', 'confirmed', 'shipped']),
    ])
    if ((stock ?? []).some(s => Number(s.on_hand) > 0)) return { error: 'This branch still has stock. Record its sales or returns first.' }
    if ((count ?? 0) > 0) return { error: 'This branch has orders on the way.' }
  }
  await db.from('sensare_partner_locations').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id)
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
  const db = supabaseAdmin()
  const { data: st } = await db.from('sensare_partner_consignment_settlements').select('amount_php').eq('id', res.id!).single()
  const amount = Number(st?.amount_php ?? 0)
  if (amount <= 0) {
    await db.from('sensare_partner_consignment_settlements').update({ status: 'failed' }).eq('id', res.id!)
    return { error: 'These consignment orders are already fully paid.' }
  }
  try {
    const hitpay = await createHitpayRequest({
      reference, amount, partner,
      purpose: `Sensarè consignment ${period.from} to ${period.to}`,
      returnPath: '/partners/portal/consignment?paid=1',
    })
    await db.from('sensare_partner_consignment_settlements').update({ hitpay_payment_id: hitpay.id }).eq('id', res.id!)
    return { url: hitpay.url }
  } catch (e) {
    console.error('HitPay settlement failed', e)
    await db.from('sensare_partner_consignment_settlements').update({ status: 'failed' }).eq('id', res.id!)
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
  const { data: st } = await supabaseAdmin().from('sensare_partner_consignment_settlements').select('amount_php').eq('id', res.id!).single()
  await email.settlementReported(partner, Number(st?.amount_php ?? 0), reference, period.from, period.to)
  revalidatePath('/partners/portal', 'layout')
  return { ok: 'Thanks! We’ll verify your transfer and update your consignment balance.' }
}

// ---------------------------------------------------------------- Account

export async function updateAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const contact_name = str(fd, 'contact_name', 200)
  const phone = str(fd, 'phone', 50)
  if (!contact_name || !phone) return { error: 'Contact person and phone are required.' }
  const { error } = await supabaseAdmin().from('sensare_partners').update({
    contact_name, phone,
    address: str(fd, 'address', 300) || null,
    city: str(fd, 'city', 100) || partner.city,
    province: str(fd, 'province', 100) || null,
    sales_channels: str(fd, 'sales_channels', 500) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', partner.id)
  if (error) return { error: 'Could not save your details.' }
  revalidatePath('/partners/portal', 'layout')
  return { ok: 'Details saved.' }
}
