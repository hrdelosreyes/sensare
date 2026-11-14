'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { requireApprovedPartner, getUser } from '@/lib/auth'
import { getPartnerCatalog } from '@/lib/partner-data'
import { createHitpayPayment } from '@/lib/hitpay'
import { email } from '@/lib/email'
import { ADJUSTMENT_REASONS, balance, isIsoDate, isPaymentTerms, manilaToday, addDays, type PartnerOrder } from '@/lib/partner'

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
  return /^(Not enough|Only |Order |Adjustment|Units|Sale date|Quantity)/.test(m) ? m : fallback
}

// ---------------------------------------------------------------- Orders

export async function placeOrderAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const catalog = await getPartnerCatalog(partner.id)

  const items = catalog
    .map(p => ({ p, qty: Math.floor(Number(fd.get(`qty_${p.id}`) || 0)) }))
    .filter(i => i.qty > 0)
  if (!items.length) return { error: 'Add at least one case to your order.' }
  if (items.some(i => !Number.isFinite(i.qty) || i.qty > 999)) return { error: 'Please enter a valid number of cases (max 999).' }

  const terms = String(fd.get('payment_terms') || partner.default_payment_terms)
  if (!isPaymentTerms(terms)) return { error: 'Please choose payment terms.' }

  const lines = items.map(({ p, qty }) => ({
    product_id: p.id,
    product_name: p.name,
    case_qty: qty,
    case_size: p.case_size,
    case_price_php: p.effective_case_price!,
    line_total_php: Math.round(qty * p.effective_case_price! * 100) / 100,
  }))
  const subtotal = lines.reduce((s, l) => s + l.line_total_php, 0)

  const db = supabaseAdmin()
  const { data: order, error } = await db.from('sensare_partner_orders').insert({
    partner_id: partner.id,
    payment_terms: terms,
    subtotal_php: subtotal,
    shipping_php: 0,
    total_php: subtotal,
    shipping_address: str(fd, 'shipping_address', 500) || [partner.address, partner.city, partner.province].filter(Boolean).join(', '),
    partner_notes: str(fd, 'partner_notes', 1000) || null,
    created_by: user?.id ?? null,
  }).select('*').single()
  if (error || !order) {
    console.error('Order insert failed', error)
    return { error: 'We could not place your order. Please try again.' }
  }

  const { error: itemErr } = await db.from('sensare_partner_order_items').insert(lines.map(l => ({ ...l, order_id: order.id })))
  if (itemErr) {
    console.error('Order items insert failed', itemErr)
    await db.from('sensare_partner_orders').delete().eq('id', order.id)
    return { error: 'We could not place your order. Please try again.' }
  }

  await email.orderPlaced(order, partner)
  revalidatePath('/partners/portal', 'layout')
  redirect(`/partners/portal/orders/${order.id}?placed=1`)
}

export async function cancelOwnOrderAction(fd: FormData) {
  const partner = await requireApprovedPartner()
  const order = await getOwnOrder(partner.id, String(fd.get('order_id')))
  if (!order || order.status !== 'submitted') return
  await supabaseAdmin().rpc('sensare_partner_cancel_order', { p_order_id: order.id })
  revalidatePath(`/partners/portal/orders/${order.id}`)
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

// ---------------------------------------------------------------- Sales

export async function saveSalesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const date = str(fd, 'sale_date', 10)
  const today = manilaToday()
  if (!isIsoDate(date)) return { error: 'Choose a valid date.' }
  if (date > today) return { error: 'You can’t record sales for a future date.' }
  if (date < addDays(today, -90)) return { error: 'Sales older than 90 days can’t be changed here — please contact us.' }

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
      p_partner_id: partner.id, p_product_id: pid, p_sale_date: date,
      p_units: units, p_unit_price: price, p_notes: str(fd, 'notes', 500) || null, p_user_id: user?.id ?? null,
    })
    if (error) errors.push(dbError(error, 'Could not save one of the entries.'))
    else saved++
  }
  revalidatePath('/partners/portal', 'layout')
  if (errors.length) return { error: errors.join(' ') }
  return { ok: saved ? 'Sales saved and inventory updated.' : 'Nothing to save — enter units sold.' }
}

// ---------------------------------------------------------------- Inventory

export async function adjustInventoryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const partner = await requireApprovedPartner()
  const user = await getUser()
  const productId = str(fd, 'product_id', 64)
  const qty = Math.floor(Number(fd.get('qty')))
  const reason = str(fd, 'reason', 50)
  if (!productId) return { error: 'Choose a product.' }
  if (!(qty > 0)) return { error: 'Enter the number of units to remove.' }
  if (!(reason in ADJUSTMENT_REASONS)) return { error: 'Choose a reason.' }
  const expiry = str(fd, 'expiry_date', 10)

  // Partners can only remove stock; increases come from deliveries or admin.
  const { error } = await supabaseAdmin().rpc('sensare_partner_adjust_inventory', {
    p_partner_id: partner.id, p_product_id: productId, p_qty_change: -qty, p_reason: reason,
    p_notes: str(fd, 'notes', 500) || null, p_batch: str(fd, 'batch_code', 50) || null,
    p_expiry: isIsoDate(expiry) ? expiry : null, p_user_id: user?.id ?? null,
  })
  if (error) return { error: dbError(error, 'Could not save the adjustment.') }
  revalidatePath('/partners/portal', 'layout')
  return { ok: 'Inventory updated.' }
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
