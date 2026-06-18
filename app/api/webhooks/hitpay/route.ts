import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

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

  if (status !== 'completed') {
    await supabaseAdmin().from('orders')
      .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
      .eq('reference_number', refNum)
    return NextResponse.json({ ok: true })
  }

  const { data: order } = await supabaseAdmin()
    .from('orders').select('*').eq('reference_number', refNum).single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.payment_status === 'paid') return NextResponse.json({ ok: true }) // idempotent

  // Mark paid
  await supabaseAdmin().from('orders')
    .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
    .eq('reference_number', refNum)

  // Decrement stock
  const items = order.items as Array<{ product_id: string; qty: number }>
  for (const item of items) {
    await supabaseAdmin().rpc('decrement_stock', { p_product_id: item.product_id, p_qty: item.qty })
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
