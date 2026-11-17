import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db, one } from '@/lib/db'
import { Resend } from 'resend'
import { PARTNER_REF_PREFIX } from '@/lib/hitpay'
import { SETTLEMENT_REF_PREFIX } from '@/lib/consignment'
import { manilaToday } from '@/lib/partner'
import { email } from '@/lib/email'

function verifySignature(payload: string, signature: string): boolean {
  const hmac = createHmac('sha256', process.env.HITPAY_SALT!)
  const computed = hmac.update(payload).digest('hex')
  return computed === signature
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-hitpay-signature') || ''

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const params = new URLSearchParams(body)
  const refNum = params.get('reference_number') || ''
  const status = params.get('status') || ''
  const paymentId = params.get('payment_id') || ''

  // Partner (wholesale) order payments
  if (refNum.startsWith(PARTNER_REF_PREFIX)) {
    return handlePartnerPayment(refNum, status, paymentId)
  }
  // Partner consignment settlements
  if (refNum.startsWith(SETTLEMENT_REF_PREFIX)) {
    return handleSettlementPayment(refNum, status, paymentId)
  }

  if (status !== 'completed') {
    await db()`update sensare_orders set payment_status = 'failed', updated_at = now()
      where reference_number = ${refNum} and payment_status <> 'paid'`
    return NextResponse.json({ ok: true })
  }

  // Mark paid atomically; a repeated webhook finds nothing to update (idempotent).
  const order = await one(db()<{ items: Array<{ product_id: string; qty: number }>; customer_email: string }[]>`
    update sensare_orders set payment_status = 'paid', updated_at = now()
    where reference_number = ${refNum} and payment_status <> 'paid'
    returning items, customer_email`)
  if (!order) {
    const exists = await one(db()`select 1 from sensare_orders where reference_number = ${refNum}`)
    return exists ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Decrement stock (row-locked, returns false if insufficient)
  for (const item of order.items) {
    const row = await one(db()<{ ok: boolean }[]>`select sensare_decrement_stock(${item.product_id}::uuid, ${item.qty}::int) as ok`)
    if (!row?.ok) console.warn(`Stock insufficient for product ${item.product_id} — auto-replenish should cover this`)
  }

  // Send confirmation email if we have a real email
  if (order.customer_email && order.customer_email !== 'pending@sensare.com') {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Sensarè Chocolates <noreply@mysensare.com>',
      to: order.customer_email,
      subject: `Your Sensarè order is confirmed ♥`,
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#1c0e09;color:#faf0e4;padding:40px 32px;">
          <h2 style="color:#c9906a;font-size:28px;margin-bottom:8px;">Your order is confirmed.</h2>
          <p style="color:#e8d8c4;font-size:16px;line-height:1.8;margin-bottom:24px;">
            Thank you for choosing Sensarè. Your ritual is on its way.
          </p>
          <p style="font-size:14px;color:#a08070;">Order reference: <strong style="color:#c9906a">${refNum}</strong></p>
          <p style="font-size:14px;color:#a08070;margin-top:32px;font-style:italic;">Unwrap. Savor. Ignite. ♥</p>
        </div>
      `,
    })
  }

  return NextResponse.json({ ok: true })
}

async function handlePartnerPayment(refNum: string, status: string, paymentId: string) {
  const sql = db()
  if (status !== 'completed') {
    await sql`update sensare_partner_payments set status = 'failed'
      where reference = ${refNum} and method = 'hitpay' and status = 'pending'`
    return NextResponse.json({ ok: true })
  }
  // Confirm atomically; the payments trigger updates the order balance.
  const payment = await one(sql<{ order_id: string; partner_id: string; amount_php: number }[]>`
    update sensare_partner_payments
    set status = 'confirmed', confirmed_at = now(), paid_on = ${manilaToday()}::date,
        notes = coalesce(${paymentId ? `HitPay payment ${paymentId}` : null}::text, notes)
    where reference = ${refNum} and method = 'hitpay' and status <> 'confirmed'
    returning order_id, partner_id, amount_php`)
  if (!payment) {
    const exists = await one(sql`select 1 from sensare_partner_payments where reference = ${refNum}`)
    return exists ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }
  const info = await one(sql<{ id: string; order_number: string; email: string }[]>`
    select o.id, o.order_number, p.email from sensare_partner_orders o join sensare_partners p on p.id = o.partner_id
    where o.id = ${payment.order_id}`)
  if (info) await email.paymentConfirmed(info, info, payment.amount_php)
  return NextResponse.json({ ok: true })
}

async function handleSettlementPayment(refNum: string, status: string, paymentId: string) {
  const sql = db()
  const st = await one(sql<{ id: string; status: string; amount_php: number; partner_id: string; period_from: string; period_to: string }[]>`
    select * from sensare_partner_consignment_settlements where reference = ${refNum} and method = 'hitpay'`)
  if (!st) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
  if (st.status === 'confirmed') return NextResponse.json({ ok: true }) // idempotent

  // Status change cascades to the settlement's order payments (DB trigger).
  if (status !== 'completed') {
    await sql`update sensare_partner_consignment_settlements set status = 'failed' where id = ${st.id} and status = 'pending'`
    return NextResponse.json({ ok: true })
  }
  if (st.status !== 'pending') {
    // Paid after the checkout expired: money is real, so record it, but flag it —
    // the partner may have settled the same period again since.
    console.error('Late HitPay settlement payment', st.id)
    await email.lateSettlementPayment(st.id, st.amount_php)
  }
  const updated = await one(sql`
    update sensare_partner_consignment_settlements
    set status = 'confirmed', confirmed_at = now(), paid_on = ${manilaToday()}::date,
        hitpay_payment_id = coalesce(${paymentId || null}::text, hitpay_payment_id)
    where id = ${st.id} and status <> 'confirmed'
    returning id`)
  if (!updated) return NextResponse.json({ ok: true })

  const partner = await one(sql<{ email: string }[]>`select email from sensare_partners where id = ${st.partner_id}`)
  if (partner) await email.settlementConfirmed(partner, st.amount_php, st.period_from, st.period_to)
  return NextResponse.json({ ok: true })
}
