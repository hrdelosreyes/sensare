import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
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
    await supabaseAdmin().from('sensare_orders')
      .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
      .eq('reference_number', refNum)
    return NextResponse.json({ ok: true })
  }

  const { data: order } = await supabaseAdmin()
    .from('sensare_orders').select('*').eq('reference_number', refNum).single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.payment_status === 'paid') return NextResponse.json({ ok: true }) // idempotent

  // Mark paid
  await supabaseAdmin().from('sensare_orders')
    .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
    .eq('reference_number', refNum)

  // Decrement stock (row-locked, returns false if insufficient)
  const items = order.items as Array<{ product_id: string; qty: number }>
  for (const item of items) {
    const { data: ok } = await supabaseAdmin().rpc('sensare_decrement_stock', { p_product_id: item.product_id, p_qty: item.qty })
    if (!ok) console.warn(`Stock insufficient for product ${item.product_id} — auto-replenish should cover this`)
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
  const db = supabaseAdmin()
  const { data: payment } = await db.from('sensare_partner_payments')
    .select('*').eq('reference', refNum).eq('method', 'hitpay').maybeSingle()
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (payment.status === 'confirmed') return NextResponse.json({ ok: true }) // idempotent

  if (status !== 'completed') {
    await db.from('sensare_partner_payments').update({ status: 'failed' }).eq('id', payment.id)
    return NextResponse.json({ ok: true })
  }

  await db.from('sensare_partner_payments').update({
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    paid_on: manilaToday(),
    notes: paymentId ? `HitPay payment ${paymentId}` : payment.notes,
  }).eq('id', payment.id)

  const [{ data: order }, { data: partner }] = await Promise.all([
    db.from('sensare_partner_orders').select('id, order_number').eq('id', payment.order_id).single(),
    db.from('sensare_partners').select('email').eq('id', payment.partner_id).single(),
  ])
  if (order && partner) await email.paymentConfirmed(order, partner, Number(payment.amount_php))
  return NextResponse.json({ ok: true })
}

async function handleSettlementPayment(refNum: string, status: string, paymentId: string) {
  const db = supabaseAdmin()
  const { data: st } = await db.from('sensare_partner_consignment_settlements')
    .select('*').eq('reference', refNum).eq('method', 'hitpay').maybeSingle()
  if (!st) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
  if (st.status === 'confirmed') return NextResponse.json({ ok: true }) // idempotent

  // Status change cascades to the settlement's order payments (DB trigger).
  if (status !== 'completed') {
    await db.from('sensare_partner_consignment_settlements').update({ status: 'failed' }).eq('id', st.id)
    return NextResponse.json({ ok: true })
  }
  if (st.status !== 'pending') {
    // Paid after the checkout expired: money is real, so record it, but flag it —
    // the partner may have settled the same period again since.
    console.error('Late HitPay settlement payment', st.id)
    await email.lateSettlementPayment(st.id, Number(st.amount_php))
  }
  await db.from('sensare_partner_consignment_settlements').update({
    status: 'confirmed', confirmed_at: new Date().toISOString(), paid_on: manilaToday(),
    hitpay_payment_id: paymentId || st.hitpay_payment_id,
  }).eq('id', st.id)

  const { data: partner } = await db.from('sensare_partners').select('email').eq('id', st.partner_id).single()
  if (partner) await email.settlementConfirmed(partner, Number(st.amount_php), st.period_from, st.period_to)
  return NextResponse.json({ ok: true })
}
