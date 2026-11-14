'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabase-server'
import { getAdmin, requireAdmin } from '@/lib/auth'
import { email } from '@/lib/email'
import { cancelPendingOnlineSettlements, createSettlement, getConsignmentState } from '@/lib/consignment'
import { refreshSuggestion } from '@/lib/forecast'
import { addDays, isIsoDate, isPaymentTerms, manilaToday, ADJUSTMENT_REASONS, PAYMENT_METHOD, type PartnerOrder, type PaymentMethod } from '@/lib/partner'

export type FormState = { error?: string; ok?: string } | undefined

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)
const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  if (s === '') return null
  const n = Math.round(Number(s) * 100) / 100
  return Number.isFinite(n) && n >= 0 ? n : NaN
}
const errMsg = (e: { message?: string } | null) => e?.message?.replace(/^.*?ERROR:\s*/, '') ?? 'Something went wrong.'

// ---------------------------------------------------------------- Auth

export async function adminLoginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const sb = await supabaseAuth()
  const { error } = await sb.auth.signInWithPassword({ email: str(fd, 'email', 200).toLowerCase(), password: String(fd.get('password') ?? '') })
  if (error) return { error: 'Incorrect email or password.' }
  if (!(await getAdmin())) {
    await sb.auth.signOut()
    return { error: 'This account does not have admin access.' }
  }
  redirect('/admin')
}

export async function adminLogoutAction() {
  const sb = await supabaseAuth()
  await sb.auth.signOut()
  redirect('/admin/login')
}

// ---------------------------------------------------------------- Partners

export async function setPartnerStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const id = str(fd, 'partner_id', 64)
  const status = str(fd, 'status', 20)
  if (!['approved', 'rejected', 'suspended', 'pending'].includes(status)) return { error: 'Invalid status.' }
  const note = str(fd, 'note', 1000) || null
  const db = supabaseAdmin()
  const { data: partner } = await db.from('sensare_partners').select('*').eq('id', id).single()
  if (!partner) return { error: 'Partner not found.' }

  const update: Record<string, unknown> = { status, reviewed_by: admin.user_id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  const terms = str(fd, 'default_payment_terms', 20)
  if (terms && isPaymentTerms(terms)) update.default_payment_terms = terms
  const { error } = await db.from('sensare_partners').update(update).eq('id', id)
  if (error) return { error: errMsg(error) }

  if (partner.status !== status && fd.get('notify') !== 'off') await email.partnerStatusChanged(partner, status, note)
  revalidatePath('/admin/partners', 'layout')
  return { ok: `Partner ${status === 'approved' ? 'approved' : status}.` }
}

export async function updatePartnerAdminAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const id = str(fd, 'partner_id', 64)
  const terms = str(fd, 'default_payment_terms', 20)
  if (!isPaymentTerms(terms)) return { error: 'Choose default payment terms.' }
  const business_name = str(fd, 'business_name', 200)
  if (!business_name) return { error: 'Business name is required.' }
  const period = Math.floor(Number(fd.get('consignment_period_days') || 7))
  if (!(period >= 1 && period <= 90)) return { error: 'Settlement period must be 1–90 days.' }
  const { error } = await supabaseAdmin().from('sensare_partners').update({
    consignment_period_days: period,
    default_payment_terms: terms,
    business_name,
    tin: str(fd, 'tin', 50) || null,
    admin_notes: str(fd, 'admin_notes', 2000) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: errMsg(error) }
  revalidatePath(`/admin/partners/${id}`)
  return { ok: 'Saved.' }
}

export async function savePartnerPricesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const partnerId = str(fd, 'partner_id', 64)
  const productIds = fd.getAll('product_id').map(String)
  const rows = []
  for (const pid of productIds) {
    const price = money(fd.get(`price_${pid}`))
    if (Number.isNaN(price)) return { error: 'Prices must be valid amounts.' }
    rows.push({ partner_id: partnerId, product_id: pid, case_price_php: price, is_available: fd.get(`available_${pid}`) === 'on', updated_at: new Date().toISOString() })
  }
  const { error } = await supabaseAdmin().from('sensare_partner_prices').upsert(rows, { onConflict: 'partner_id,product_id' })
  if (error) return { error: errMsg(error) }
  revalidatePath(`/admin/partners/${partnerId}`)
  return { ok: 'Price list saved.' }
}

export async function adminAdjustInventoryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const partnerId = str(fd, 'partner_id', 64)
  const qty = Math.trunc(Number(fd.get('qty')))
  const reason = str(fd, 'reason', 50)
  if (!qty) return { error: 'Enter a non-zero quantity (use a minus sign to remove).' }
  if (!(reason in ADJUSTMENT_REASONS)) return { error: 'Choose a reason.' }
  const [locationId, productId] = str(fd, 'stock_key', 80).split('|')
  if (!locationId || !productId) return { error: 'Choose a branch and product.' }
  const { error } = await supabaseAdmin().rpc('sensare_partner_adjust_inventory', {
    p_partner_id: partnerId, p_location_id: locationId, p_product_id: productId, p_qty_change: qty, p_reason: reason,
    p_notes: str(fd, 'notes', 500) || null, p_batch: null, p_expiry: null, p_user_id: admin.user_id,
  })
  if (error) return { error: errMsg(error) }
  revalidatePath(`/admin/partners/${partnerId}`)
  return { ok: 'Inventory adjusted.' }
}

// ---------------------------------------------------------------- Orders

async function loadOrder(id: string) {
  const db = supabaseAdmin()
  const { data } = await db.from('sensare_partner_orders').select('*, sensare_partners(*)').eq('id', id).single()
  return data as (PartnerOrder & { sensare_partners: { email: string; business_name: string } }) | null
}

export async function orderTransitionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const id = str(fd, 'order_id', 64)
  const to = str(fd, 'to', 20)
  const order = await loadOrder(id)
  if (!order) return { error: 'Order not found.' }
  const db = supabaseAdmin()

  let error: { message?: string } | null = null
  if (to === 'confirmed') {
    ({ error } = await db.rpc('sensare_partner_confirm_order', { p_order_id: id }))
  } else if (to === 'shipped') {
    if (order.status !== 'confirmed') return { error: 'Only confirmed orders can be shipped.' }
    ;({ error } = await db.from('sensare_partner_orders').update({
      status: 'shipped', shipped_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      tracking_info: str(fd, 'tracking_info', 300) || order.tracking_info,
    }).eq('id', id).eq('status', 'confirmed'))
  } else if (to === 'delivered') {
    ({ error } = await db.rpc('sensare_partner_deliver_order', { p_order_id: id, p_user_id: admin.user_id }))
  } else if (to === 'cancelled') {
    ({ error } = await db.rpc('sensare_partner_cancel_order', { p_order_id: id }))
  } else {
    return { error: 'Invalid status.' }
  }
  if (error) return { error: errMsg(error) }

  await email.orderStatusChanged({ ...order, tracking_info: str(fd, 'tracking_info', 300) || order.tracking_info }, order.sensare_partners, to)
  revalidatePath('/admin/partner-orders', 'layout')
  return { ok: `Order marked ${to}.` }
}

export async function updateOrderAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const id = str(fd, 'order_id', 64)
  const order = await loadOrder(id)
  if (!order) return { error: 'Order not found.' }
  if (order.status === 'cancelled') return { error: 'Cancelled orders can’t be edited.' }

  const terms = str(fd, 'payment_terms', 20)
  if (!isPaymentTerms(terms)) return { error: 'Choose payment terms.' }
  const shipping = money(fd.get('shipping_php')) ?? 0
  if (Number.isNaN(shipping)) return { error: 'Shipping fee must be a valid amount.' }

  const update: Record<string, unknown> = {
    payment_terms: terms,
    shipping_php: shipping,
    total_php: Math.round((Number(order.subtotal_php) + shipping) * 100) / 100,
    tracking_info: str(fd, 'tracking_info', 300) || null,
    admin_notes: str(fd, 'admin_notes', 2000) || null,
    updated_at: new Date().toISOString(),
  }
  // Due date follows the terms once delivered; admins can override it.
  const dueOverride = str(fd, 'due_date', 10)
  if (dueOverride && isIsoDate(dueOverride)) update.due_date = dueOverride
  else if (order.delivered_at && terms !== order.payment_terms) {
    const delivered = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(order.delivered_at))
    update.due_date = terms === 'net30' ? addDays(delivered, 30) : terms === 'cod' ? delivered : null
  } else if (!dueOverride && fd.get('clear_due') === 'on') update.due_date = null

  const { error } = await supabaseAdmin().from('sensare_partner_orders').update(update).eq('id', id)
  if (error) return { error: errMsg(error) }
  revalidatePath(`/admin/partner-orders/${id}`)
  return { ok: 'Order updated.' }
}

// ---------------------------------------------------------------- Payments

export async function recordPaymentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const id = str(fd, 'order_id', 64)
  const order = await loadOrder(id)
  if (!order || order.status === 'cancelled') return { error: 'Order not found.' }
  const amount = money(fd.get('amount'))
  const method = str(fd, 'method', 20) as PaymentMethod
  if (!amount || Number.isNaN(amount) || amount <= 0) return { error: 'Enter a payment amount.' }
  if (!(method in PAYMENT_METHOD) || method === 'hitpay') return { error: 'Choose a payment method.' }
  const paidOn = str(fd, 'paid_on', 10)

  const { error } = await supabaseAdmin().from('sensare_partner_payments').insert({
    order_id: id, partner_id: order.partner_id, amount_php: amount, method, status: 'confirmed',
    reference: str(fd, 'reference', 100) || null, notes: str(fd, 'notes', 500) || null,
    paid_on: isIsoDate(paidOn) ? paidOn : manilaToday(),
    created_by: admin.user_id, confirmed_by: admin.user_id, confirmed_at: new Date().toISOString(),
  })
  if (error) return { error: errMsg(error) }
  if (fd.get('notify') === 'on') await email.paymentConfirmed(order, order.sensare_partners, amount)
  revalidatePath(`/admin/partner-orders/${id}`)
  return { ok: 'Payment recorded.' }
}

export async function reviewPaymentAction(fd: FormData) {
  const admin = await requireAdmin()
  const paymentId = str(fd, 'payment_id', 64)
  const decision = str(fd, 'decision', 20)
  if (decision !== 'confirmed' && decision !== 'rejected') return
  const db = supabaseAdmin()
  const { data: payment } = await db.from('sensare_partner_payments').select('*').eq('id', paymentId).single()
  if (!payment || payment.status !== 'pending' || payment.settlement_id) return
  await db.from('sensare_partner_payments').update({
    status: decision, confirmed_by: admin.user_id, confirmed_at: new Date().toISOString(),
  }).eq('id', paymentId)
  if (decision === 'confirmed') {
    const order = await loadOrder(payment.order_id)
    if (order) await email.paymentConfirmed(order, order.sensare_partners, Number(payment.amount_php))
  }
  revalidatePath(`/admin/partner-orders/${payment.order_id}`)
}

// ---------------------------------------------------------------- Team

export async function addAdminAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const emailAddr = str(fd, 'email', 200).toLowerCase()
  const name = str(fd, 'name', 100) || null
  const password = String(fd.get('password') ?? '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr)) return { error: 'Enter a valid email.' }

  const db = supabaseAdmin()

  // Existing account (e.g. a partner or BukidBox user)? Grant access to it.
  let userId: string | null = null
  for (let page = 1; page <= 50 && !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return { error: errMsg(error) }
    userId = data.users.find(u => u.email?.toLowerCase() === emailAddr)?.id ?? null
    if (data.users.length < 1000) break
  }

  const isNew = !userId
  if (isNew) {
    if (password.length < 8) return { error: 'Set a temporary password of at least 8 characters for the new admin.' }
    const { data: created, error } = await db.auth.admin.createUser({ email: emailAddr, password, email_confirm: true })
    if (error || !created.user) return { error: errMsg(error) }
    userId = created.user.id
  }

  const { error: insErr } = await db.from('sensare_admins').upsert({ user_id: userId, email: emailAddr, name, created_by: admin.user_id })
  if (insErr) return { error: errMsg(insErr) }
  revalidatePath('/admin/team')
  return {
    ok: isNew
      ? `Admin added. Share the temporary password with ${emailAddr} privately; they can change it under Team after logging in.`
      : `${emailAddr} already had an account and now has admin access with their existing password.`,
  }
}

export async function removeAdminAction(fd: FormData) {
  const admin = await requireAdmin()
  const userId = str(fd, 'user_id', 64)
  if (userId === admin.user_id) return
  const db = supabaseAdmin()
  const { count } = await db.from('sensare_admins').select('*', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) return
  await db.from('sensare_admins').delete().eq('user_id', userId)
  revalidatePath('/admin/team')
}

export async function changeOwnPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const password = String(fd.get('password') ?? '')
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'Passwords do not match.' }
  const sb = await supabaseAuth()
  const { error } = await sb.auth.updateUser({ password })
  if (error) return { error: error.message }
  return { ok: 'Password updated.' }
}

// ---------------------------------------------------------------- Settings

export async function saveSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const db = supabaseAdmin()
  const n = (k: string) => Math.floor(Number(fd.get(k)))
  const lead = n('partner_lead_time_days'), cover = n('partner_cover_days'), safety = n('partner_safety_days')
  if (!(lead >= 1 && lead <= 90)) return { error: 'Lead time must be 1–90 days.' }
  if (!(cover >= 1 && cover <= 120)) return { error: 'Order cover must be 1–120 days.' }
  if (!(safety >= 0 && safety <= 60)) return { error: 'Safety buffer must be 0–60 days.' }
  const now = new Date().toISOString()
  const { error } = await db.from('sensare_settings').upsert([
    { key: 'partner_bank_details', value: str(fd, 'partner_bank_details', 2000), updated_at: now },
    { key: 'partner_lead_time_days', value: String(lead), updated_at: now },
    { key: 'partner_cover_days', value: String(cover), updated_at: now },
    { key: 'partner_safety_days', value: String(safety), updated_at: now },
  ])
  if (error) return { error: errMsg(error) }

  for (const pid of fd.getAll('product_id').map(String)) {
    const price = money(fd.get(`wholesale_${pid}`))
    const caseSize = Math.floor(Number(fd.get(`case_size_${pid}`)))
    if (Number.isNaN(price)) return { error: 'Default case prices must be valid amounts.' }
    if (!(caseSize >= 1 && caseSize <= 1000)) return { error: 'Case size must be at least 1.' }
    const { error: pErr } = await db.from('sensare_products').update({
      wholesale_case_price_php: price, case_size: caseSize, is_wholesale: fd.get(`wholesale_on_${pid}`) === 'on',
    }).eq('id', pid)
    if (pErr) return { error: errMsg(pErr) }
  }
  revalidatePath('/admin', 'layout')
  return { ok: 'Settings saved.' }
}

// ---------------------------------------------------------------- Consignment

export async function reviewSettlementAction(fd: FormData) {
  const admin = await requireAdmin()
  const id = str(fd, 'settlement_id', 64)
  const decision = str(fd, 'decision', 20)
  if (decision !== 'confirmed' && decision !== 'rejected') return
  const db = supabaseAdmin()
  const { data: st } = await db.from('sensare_partner_consignment_settlements').select('*, sensare_partners(email)').eq('id', id).single()
  if (!st || st.status !== 'pending' || st.method === 'hitpay') return
  // Payments follow via the settlement status trigger.
  await db.from('sensare_partner_consignment_settlements').update({
    status: decision, confirmed_by: admin.user_id, confirmed_at: new Date().toISOString(),
  }).eq('id', id)
  if (decision === 'confirmed' && st.sensare_partners) {
    await email.settlementConfirmed(st.sensare_partners, Number(st.amount_php), st.period_from, st.period_to)
  }
  revalidatePath('/admin', 'layout')
}

export async function recordSettlementAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const partnerId = str(fd, 'partner_id', 64)
  const to = str(fd, 'period_to', 10)
  const method = str(fd, 'method', 20)
  if (!['cash', 'check', 'bank_transfer', 'other'].includes(method)) return { error: 'Choose a payment method.' }
  const { data: partner } = await supabaseAdmin().from('sensare_partners').select('*').eq('id', partnerId).single()
  if (!partner) return { error: 'Partner not found.' }
  await cancelPendingOnlineSettlements(partnerId)
  const state = await getConsignmentState(partner)
  if (!state.nextFrom) return { error: 'Nothing to settle for this partner.' }
  if (!isIsoDate(to) || to < state.nextFrom || to > manilaToday()) return { error: 'Choose a valid period end date.' }
  const paidOn = str(fd, 'paid_on', 10)
  const res = await createSettlement({
    partnerId, from: state.nextFrom, to, method, status: 'confirmed',
    reference: str(fd, 'reference', 100) || null, notes: str(fd, 'notes', 500) || null,
    paidOn: isIsoDate(paidOn) ? paidOn : manilaToday(), userId: admin.user_id,
  })
  if (res.error) return { error: res.error }
  if (fd.get('notify') === 'on') {
    const { data: st } = await supabaseAdmin().from('sensare_partner_consignment_settlements').select('amount_php').eq('id', res.id!).single()
    await email.settlementConfirmed(partner, Number(st?.amount_php ?? 0), state.nextFrom, to)
  }
  revalidatePath('/admin', 'layout')
  return { ok: 'Settlement recorded.' }
}

export async function generateSuggestionAction(fd: FormData) {
  await requireAdmin()
  const { data: partner } = await supabaseAdmin().from('sensare_partners').select('*').eq('id', str(fd, 'partner_id', 64)).single()
  if (!partner) return
  await refreshSuggestion(partner, fd.get('notify') === 'on')
  revalidatePath(`/admin/partners/${partner.id}`)
}
