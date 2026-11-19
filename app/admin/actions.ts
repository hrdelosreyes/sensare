'use server'
import { refreshShopPages } from '@/lib/shop-cache'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db, dbMessage, one } from '@/lib/db'
import {
  createUser, endSession, findUserByEmail, getAdmin, isEmail, normalizeEmail, requireAdmin, setPassword, signIn, verifyPassword,
  type Admin,
} from '@/lib/auth'
import { email } from '@/lib/email'
import { can, homeFor, isStaffRole } from '@/lib/roles'
import { cancelPendingOnlineSettlements, createSettlement, getConsignmentState } from '@/lib/consignment'
import { refreshSuggestion } from '@/lib/forecast'
import {
  addDays, isIsoDate, isPaymentTerms, manilaToday, ADJUSTMENT_REASONS, PAYMENT_METHOD,
  type Partner, type PartnerOrder, type PaymentMethod,
} from '@/lib/partner'

export type FormState = { error?: string; ok?: string } | undefined

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  if (s === '') return null
  const n = Math.round(Number(s) * 100) / 100
  return Number.isFinite(n) && n >= 0 ? n : NaN
}
// Messages raised by our SQL functions are meant for admins; anything else is generic.
const errMsg = (e: unknown) => dbMessage(e) || 'Something went wrong.'

// ---------------------------------------------------------------- Auth

export async function adminLoginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = await signIn(str(fd, 'email', 200), String(fd.get('password') ?? ''))
  if (res.error) return { error: res.error }
  const admin = await getAdmin()
  if (!admin) {
    await endSession()
    return { error: 'This account does not have admin access.' }
  }
  redirect(homeFor(admin.role))
}

export async function adminLogoutAction() {
  await endSession()
  redirect('/admin/login')
}

// ---------------------------------------------------------------- Partners

// Account managers can only load their own partners (and those partners' orders).
const scope = (admin: Admin | null, col: string) =>
  admin?.role === 'account_manager' ? db()`and ${db()(col)} = ${admin.user_id}` : db()``

async function loadPartner(id: string, admin: Admin | null = null) {
  return isUuid(id) ? one(db()<Partner[]>`select * from sensare_partners where id = ${id} ${scope(admin, 'account_manager_id')}`) : null
}

export async function setPartnerStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin('partners.approve')
  const status = str(fd, 'status', 20)
  if (!['approved', 'rejected', 'suspended', 'pending'].includes(status)) return { error: 'Invalid status.' }
  const note = str(fd, 'note', 1000) || null
  const partner = await loadPartner(str(fd, 'partner_id', 64))
  if (!partner) return { error: 'Partner not found.' }

  const terms = str(fd, 'default_payment_terms', 20)
  await db()`update sensare_partners set
    status = ${status}, reviewed_by = ${admin.user_id}, reviewed_at = now(), updated_at = now(),
    default_payment_terms = ${isPaymentTerms(terms) ? terms : partner.default_payment_terms}
    where id = ${partner.id}`

  if (partner.status !== status && fd.get('notify') !== 'off') await email.partnerStatusChanged(partner, status, note)
  revalidatePath('/admin/partners', 'layout')
  return { ok: `Partner ${status === 'approved' ? 'approved' : status}.` }
}

export async function updatePartnerAdminAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin('partners.edit')
  const partner = await loadPartner(str(fd, 'partner_id', 64))
  if (!partner) return { error: 'Partner not found.' }
  const terms = str(fd, 'default_payment_terms', 20)
  if (!isPaymentTerms(terms)) return { error: 'Choose default payment terms.' }
  const business_name = str(fd, 'business_name', 200)
  if (!business_name) return { error: 'Business name is required.' }
  const period = Math.floor(Number(fd.get('consignment_period_days') || 7))
  if (!(period >= 1 && period <= 90)) return { error: 'Settlement period must be 1–90 days.' }
  const am = str(fd, 'account_manager_id', 64)
  if (am && !(await one(db()`select 1 from sensare_admins where user_id = ${am} and role = 'account_manager' and is_active`))) {
    return { error: 'Choose an active account manager.' }
  }
  await db()`update sensare_partners set ${db()({
    account_manager_id: am || null,
    consignment_period_days: period,
    default_payment_terms: terms,
    business_name,
    tin: str(fd, 'tin', 50) || null,
    admin_notes: str(fd, 'admin_notes', 2000) || null,
  })}, updated_at = now() where id = ${partner.id}`
  revalidatePath(`/admin/partners/${partner.id}`)
  return { ok: 'Saved.' }
}

export async function savePartnerPricesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin('partners.prices')
  const partner = await loadPartner(str(fd, 'partner_id', 64))
  if (!partner) return { error: 'Partner not found.' }
  const rows = []
  for (const pid of fd.getAll('product_id').map(String).filter(isUuid)) {
    const price = money(fd.get(`price_${pid}`))
    if (Number.isNaN(price)) return { error: 'Prices must be valid amounts.' }
    rows.push({ partner_id: partner.id, product_id: pid, case_price_php: price, is_available: fd.get(`available_${pid}`) === 'on' })
  }
  if (rows.length) {
    await db()`insert into sensare_partner_prices ${db()(rows)}
      on conflict (partner_id, product_id) do update
      set case_price_php = excluded.case_price_php, is_available = excluded.is_available, updated_at = now()`
  }
  revalidatePath(`/admin/partners/${partner.id}`)
  return { ok: 'Price list saved.' }
}

export async function adminAdjustInventoryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin('partners.edit')
  const partnerId = str(fd, 'partner_id', 64)
  const qty = Math.trunc(Number(fd.get('qty')))
  const reason = str(fd, 'reason', 50)
  if (!qty) return { error: 'Enter a non-zero quantity (use a minus sign to remove).' }
  if (!(reason in ADJUSTMENT_REASONS)) return { error: 'Choose a reason.' }
  const [locationId, productId] = str(fd, 'stock_key', 80).split('|')
  if (!isUuid(partnerId) || !isUuid(locationId ?? '') || !isUuid(productId ?? '')) return { error: 'Choose a branch and product.' }
  try {
    await db()`select sensare_partner_adjust_inventory(
      ${partnerId}::uuid, ${locationId}::uuid, ${productId}::uuid, ${qty}::int, ${reason}::text,
      ${str(fd, 'notes', 500) || null}::text, null::text, null::date, ${admin.user_id}::uuid)`
  } catch (e) {
    return { error: errMsg(e) }
  }
  revalidatePath(`/admin/partners/${partnerId}`)
  return { ok: 'Inventory adjusted.' }
}

export async function generateSuggestionAction(fd: FormData) {
  const admin = await requireAdmin('partners.suggest')
  const partner = await loadPartner(str(fd, 'partner_id', 64), admin)
  if (!partner) return
  await refreshSuggestion(partner, fd.get('notify') === 'on')
  revalidatePath(`/admin/partners/${partner.id}`)
}

// ---------------------------------------------------------------- Orders

type OrderWithPartner = PartnerOrder & { partner_email: string; business_name: string }

async function loadOrder(id: string, admin: Admin | null = null): Promise<OrderWithPartner | null> {
  if (!isUuid(id)) return null
  return one(db()<OrderWithPartner[]>`
    select o.*, p.email as partner_email, p.business_name
    from sensare_partner_orders o join sensare_partners p on p.id = o.partner_id
    where o.id = ${id} ${scope(admin, 'p.account_manager_id')}`)
}

export async function orderTransitionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin('orders.fulfill')
  const id = str(fd, 'order_id', 64)
  const to = str(fd, 'to', 20)
  const order = await loadOrder(id)
  if (!order) return { error: 'Order not found.' }
  const sql = db()
  const tracking = str(fd, 'tracking_info', 300) || order.tracking_info

  try {
    if (to === 'confirmed') {
      await sql`select sensare_partner_confirm_order(${id}::uuid)`
    } else if (to === 'shipped') {
      const rows = await sql`update sensare_partner_orders
        set status = 'shipped', shipped_at = now(), updated_at = now(), tracking_info = ${tracking}
        where id = ${id} and status = 'confirmed' returning id`
      if (!rows.length) return { error: 'Only confirmed orders can be shipped.' }
    } else if (to === 'delivered') {
      await sql`select sensare_partner_deliver_order(${id}::uuid, ${admin.user_id}::uuid)`
    } else if (to === 'cancelled') {
      await sql`select sensare_partner_cancel_order(${id}::uuid)`
    } else {
      return { error: 'Invalid status.' }
    }
  } catch (e) {
    return { error: errMsg(e) }
  }

  await email.orderStatusChanged({ ...order, tracking_info: tracking }, { email: order.partner_email }, to)
  revalidatePath('/admin/partner-orders', 'layout')
  refreshShopPages() // partner orders move warehouse stock
  return { ok: `Order marked ${to}.` }
}

export async function updateOrderAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin('orders.edit')
  const id = str(fd, 'order_id', 64)
  const order = await loadOrder(id)
  if (!order) return { error: 'Order not found.' }
  if (order.status === 'cancelled') return { error: 'Cancelled orders can’t be edited.' }

  const terms = str(fd, 'payment_terms', 20)
  if (!isPaymentTerms(terms)) return { error: 'Choose payment terms.' }
  const shipping = money(fd.get('shipping_php')) ?? 0
  if (Number.isNaN(shipping)) return { error: 'Shipping fee must be a valid amount.' }

  // Due date follows the terms once delivered; admins can override it.
  let due: string | null = order.due_date
  const dueOverride = str(fd, 'due_date', 10)
  if (dueOverride && isIsoDate(dueOverride)) due = dueOverride
  else if (order.delivered_at && terms !== order.payment_terms) {
    const delivered = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(order.delivered_at))
    due = terms === 'net30' ? addDays(delivered, 30) : terms === 'cod' ? delivered : null
  }

  await db()`update sensare_partner_orders set ${db()({
    payment_terms: terms,
    shipping_php: shipping,
    total_php: Math.round((order.subtotal_php + shipping) * 100) / 100,
    tracking_info: str(fd, 'tracking_info', 300) || null,
    admin_notes: str(fd, 'admin_notes', 2000) || null,
    due_date: due,
  })}, updated_at = now() where id = ${id}`
  revalidatePath(`/admin/partner-orders/${id}`)
  return { ok: 'Order updated.' }
}

// ---------------------------------------------------------------- Payments

export async function recordPaymentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const confirms = can(admin.role, 'payments.record')
  if (!confirms && !can(admin.role, 'payments.collect')) return { error: 'Not allowed.' }
  const id = str(fd, 'order_id', 64)
  const order = await loadOrder(id, admin)
  if (!order || order.status === 'cancelled') return { error: 'Order not found.' }
  const amount = money(fd.get('amount'))
  const method = str(fd, 'method', 20) as PaymentMethod
  if (!amount || Number.isNaN(amount) || amount <= 0) return { error: 'Enter a payment amount.' }
  if (!(method in PAYMENT_METHOD) || method === 'hitpay') return { error: 'Choose a payment method.' }
  const paidOn = str(fd, 'paid_on', 10)

  if (!confirms && method === 'return_credit') return { error: 'Return credits are recorded by Finance.' }

  await db()`insert into sensare_partner_payments ${db()({
    order_id: id, partner_id: order.partner_id, amount_php: amount, method,
    status: confirms ? 'confirmed' : 'pending',
    reference: str(fd, 'reference', 100) || null,
    notes: [confirms ? null : `Collected by ${admin.name || admin.email}`, str(fd, 'notes', 500) || null].filter(Boolean).join(' · ') || null,
    paid_on: isIsoDate(paidOn) ? paidOn : manilaToday(),
    created_by: admin.user_id,
    confirmed_by: confirms ? admin.user_id : null,
    confirmed_at: confirms ? new Date().toISOString() : null,
  })}`
  if (confirms && fd.get('notify') === 'on') await email.paymentConfirmed(order, { email: order.partner_email }, amount)
  if (!confirms) await email.collectionLogged(order, admin.name || admin.email, amount, method)
  revalidatePath(`/admin/partner-orders/${id}`)
  return { ok: confirms ? 'Payment recorded.' : 'Collection logged. It will count once Finance confirms the money arrived.' }
}

export async function reviewPaymentAction(fd: FormData) {
  const admin = await requireAdmin('payments.review')
  const paymentId = str(fd, 'payment_id', 64)
  const decision = str(fd, 'decision', 20)
  if (!isUuid(paymentId) || (decision !== 'confirmed' && decision !== 'rejected')) return
  // Settlement payments are reviewed as a whole on the Consignment page.
  const payment = await one(db()<{ order_id: string; amount_php: number }[]>`
    update sensare_partner_payments
    set status = ${decision}, confirmed_by = ${admin.user_id}, confirmed_at = now()
    where id = ${paymentId} and status = 'pending' and settlement_id is null
    returning order_id, amount_php`)
  if (!payment) return
  if (decision === 'confirmed') {
    const order = await loadOrder(payment.order_id)
    if (order) await email.paymentConfirmed(order, { email: order.partner_email }, payment.amount_php)
  }
  revalidatePath(`/admin/partner-orders/${payment.order_id}`)
}

// ---------------------------------------------------------------- Team

const newReferralCode = () => randomBytes(4).toString('hex').toUpperCase()

function readStaffFields(fd: FormData) {
  const role = str(fd, 'role', 30)
  const pctRaw = str(fd, 'commission_pct', 10)
  const pct = pctRaw === '' ? null : Number(pctRaw)
  return { role, pct, phone: str(fd, 'phone', 50) || null }
}

export async function addAdminAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin('team.manage')
  const emailAddr = normalizeEmail(str(fd, 'email', 200))
  const name = str(fd, 'name', 100) || null
  const password = String(fd.get('password') ?? '')
  const { role, pct, phone } = readStaffFields(fd)
  if (!isEmail(emailAddr)) return { error: 'Enter a valid email.' }
  if (!isStaffRole(role)) return { error: 'Choose a role.' }
  if (pct !== null && !(pct >= 0 && pct <= 100)) return { error: 'Commission must be between 0 and 100%.' }

  // Existing account (e.g. a partner)? Grant access to it; otherwise create one.
  let userId = (await findUserByEmail(emailAddr))?.id
  const isNew = !userId
  if (isNew) {
    if (password.length < 10) return { error: 'Set a temporary password of at least 10 characters for the new team member.' }
    userId = (await createUser(emailAddr, password))?.id
    if (!userId) return { error: 'Could not create the account. Please try again.' }
  } else if (await one(db()`select 1 from sensare_partners where user_id = ${userId!}`)) {
    return { error: 'That email belongs to a partner account. Use a different email for staff.' }
  }

  const isAm = role === 'account_manager'
  await db()`insert into sensare_admins (user_id, email, name, role, commission_pct, referral_code, phone, created_by, is_active)
    values (${userId!}, ${emailAddr}, ${name}, ${role}, ${isAm ? pct ?? 0 : null}, ${isAm ? newReferralCode() : null}, ${phone}, ${admin.user_id}, true)
    on conflict (user_id) do update set name = coalesce(excluded.name, sensare_admins.name), role = excluded.role,
      commission_pct = excluded.commission_pct, phone = coalesce(excluded.phone, sensare_admins.phone), is_active = true,
      referral_code = coalesce(sensare_admins.referral_code, excluded.referral_code)`
  revalidatePath('/admin/team')
  return {
    ok: isNew
      ? `Added. Share the temporary password with ${emailAddr} privately; they can change it under My Account after logging in.`
      : `${emailAddr} already had an account and now has access with their existing password.`,
  }
}

/** Change a team member's role, commission or active state. Keeps at least one active Owner. */
export async function updateStaffAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin('team.manage')
  const userId = str(fd, 'user_id', 64)
  const { role, pct, phone } = readStaffFields(fd)
  const active = fd.get('is_active') === 'on'
  if (!isUuid(userId)) return { error: 'Team member not found.' }
  if (!isStaffRole(role)) return { error: 'Choose a role.' }
  if (pct !== null && !(pct >= 0 && pct <= 100)) return { error: 'Commission must be between 0 and 100%.' }
  if (userId === admin.user_id && (role !== 'owner' || !active)) return { error: 'You can’t remove your own Owner access. Ask another Owner.' }

  const isAm = role === 'account_manager'
  const updated = await db().begin(async tx => {
    const rows = await tx`update sensare_admins set role = ${role}, is_active = ${active}, phone = ${phone},
        commission_pct = ${isAm ? pct ?? 0 : null},
        referral_code = case when ${isAm} then coalesce(referral_code, ${newReferralCode()}) else referral_code end
      where user_id = ${userId} returning user_id`
    const [{ owners }] = await tx<{ owners: number }[]>`select count(*)::int as owners from sensare_admins where role = 'owner' and is_active`
    if (owners < 1) throw new Error('last-owner')
    return rows.length > 0
  }).catch(e => (e instanceof Error && e.message === 'last-owner' ? 'last-owner' : Promise.reject(e)))
  if (updated === 'last-owner') return { error: 'There must always be at least one active Owner.' }
  if (!updated) return { error: 'Team member not found.' }
  if (!active) await db()`delete from sensare_sessions where user_id = ${userId}`
  revalidatePath('/admin/team')
  return { ok: 'Saved.' }
}

export async function removeAdminAction(fd: FormData) {
  const admin = await requireAdmin('team.manage')
  const userId = str(fd, 'user_id', 64)
  if (!isUuid(userId) || userId === admin.user_id) return
  // Never remove the last active Owner.
  await db()`delete from sensare_admins where user_id = ${userId}
    and (role <> 'owner' or (select count(*) from sensare_admins where role = 'owner' and is_active) > 1)`
  await db()`update sensare_partners set account_manager_id = null where account_manager_id = ${userId}`
  revalidatePath('/admin/team')
}

export async function changeOwnPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const password = String(fd.get('password') ?? '')
  if (password.length < 10) return { error: 'Password must be at least 10 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'Passwords do not match.' }
  const account = await findUserByEmail(admin.email)
  if (!account || !(await verifyPassword(String(fd.get('current') ?? ''), account.password_hash))) {
    return { error: 'Your current password is incorrect.' }
  }
  await setPassword(admin.user_id, password)
  return { ok: 'Password updated. Other devices have been signed out.' }
}

// ---------------------------------------------------------------- Settings

export async function saveSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin('settings.manage')
  const n = (k: string) => Math.floor(Number(fd.get(k)))
  const lead = n('partner_lead_time_days'), cover = n('partner_cover_days'), safety = n('partner_safety_days')
  if (!(lead >= 1 && lead <= 90)) return { error: 'Lead time must be 1–90 days.' }
  if (!(cover >= 1 && cover <= 120)) return { error: 'Order cover must be 1–120 days.' }
  if (!(safety >= 0 && safety <= 60)) return { error: 'Safety buffer must be 0–60 days.' }

  const products: { id: string; price: number | null; caseSize: number; on: boolean }[] = []
  for (const pid of fd.getAll('product_id').map(String).filter(isUuid)) {
    const price = money(fd.get(`wholesale_${pid}`))
    const caseSize = Math.floor(Number(fd.get(`case_size_${pid}`)))
    if (Number.isNaN(price)) return { error: 'Default case prices must be valid amounts.' }
    if (!(caseSize >= 1 && caseSize <= 1000)) return { error: 'Case size must be at least 1.' }
    products.push({ id: pid, price, caseSize, on: fd.get(`wholesale_on_${pid}`) === 'on' })
  }

  await db().begin(async tx => {
    const settings = [
      { key: 'partner_bank_details', value: str(fd, 'partner_bank_details', 2000) },
      { key: 'partner_lead_time_days', value: String(lead) },
      { key: 'partner_cover_days', value: String(cover) },
      { key: 'partner_safety_days', value: String(safety) },
    ]
    await tx`insert into sensare_settings ${tx(settings)}
      on conflict (key) do update set value = excluded.value, updated_at = now()`
    for (const p of products) {
      await tx`update sensare_products
        set wholesale_case_price_php = ${p.price}, case_size = ${p.caseSize}, is_wholesale = ${p.on}
        where id = ${p.id}`
    }
  })
  revalidatePath('/admin', 'layout')
  return { ok: 'Settings saved.' }
}

// ---------------------------------------------------------------- Consignment

export async function reviewSettlementAction(fd: FormData) {
  const admin = await requireAdmin('payments.review')
  const id = str(fd, 'settlement_id', 64)
  const decision = str(fd, 'decision', 20)
  if (!isUuid(id) || (decision !== 'confirmed' && decision !== 'rejected')) return
  // Payments follow via the settlement status trigger.
  const st = await one(db()<{ partner_id: string; amount_php: number; period_from: string; period_to: string }[]>`
    update sensare_partner_consignment_settlements
    set status = ${decision}, confirmed_by = ${admin.user_id}, confirmed_at = now()
    where id = ${id} and status = 'pending' and method <> 'hitpay'
    returning partner_id, amount_php, period_from, period_to`)
  if (st && decision === 'confirmed') {
    const partner = await one(db()<{ email: string }[]>`select email from sensare_partners where id = ${st.partner_id}`)
    if (partner) await email.settlementConfirmed(partner, st.amount_php, st.period_from, st.period_to)
  }
  revalidatePath('/admin', 'layout')
}

export async function recordSettlementAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const confirms = can(admin.role, 'payments.record')
  if (!confirms && !can(admin.role, 'payments.collect')) return { error: 'Not allowed.' }
  const to = str(fd, 'period_to', 10)
  const method = str(fd, 'method', 20)
  if (!['cash', 'check', 'bank_transfer', 'other'].includes(method)) return { error: 'Choose a payment method.' }
  const partner = await loadPartner(str(fd, 'partner_id', 64), admin)
  if (!partner) return { error: 'Partner not found.' }
  await cancelPendingOnlineSettlements(partner.id)
  const state = await getConsignmentState(partner)
  if (!state.nextFrom) return { error: 'Nothing to settle for this partner.' }
  if (!isIsoDate(to) || to < state.nextFrom || to > manilaToday()) return { error: 'Choose a valid period end date.' }
  const paidOn = str(fd, 'paid_on', 10)
  const res = await createSettlement({
    partnerId: partner.id, from: state.nextFrom, to, method, status: confirms ? 'confirmed' : 'pending',
    reference: str(fd, 'reference', 100) || null,
    notes: [confirms ? null : `Collected by ${admin.name || admin.email}`, str(fd, 'notes', 500) || null].filter(Boolean).join(' · ') || null,
    paidOn: isIsoDate(paidOn) ? paidOn : manilaToday(), userId: admin.user_id,
  })
  if (res.error) return { error: res.error }
  if (confirms && fd.get('notify') === 'on') await email.settlementConfirmed(partner, res.amount ?? 0, state.nextFrom, to)
  if (!confirms) await email.settlementReported(partner, res.amount ?? 0, `cash collected by ${admin.name || admin.email}`, state.nextFrom, to)
  revalidatePath('/admin', 'layout')
  return { ok: confirms ? 'Settlement recorded.' : 'Collection logged. It will count once Finance confirms the money arrived.' }
}
