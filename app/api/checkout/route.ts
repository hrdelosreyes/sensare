import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { productId, qty = 1 } = await req.json()
    if (!productId || qty < 1) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const { data: product } = await supabaseAdmin()
      .from('sensare_products').select('*').eq('id', productId).eq('is_active', true).single()

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (product.stock_qty < qty) return NextResponse.json({ error: 'Not enough stock' }, { status: 409 })

    const total = product.price_php * qty
    const shipping = total >= 800 ? 0 : 100
    const grandTotal = total + shipping

    const refNum = `sns_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const hitpayBase = process.env.NEXT_PUBLIC_HITPAY_MODE === 'live'
      ? 'https://api.hit-pay.com/v1'
      : 'https://api.sandbox.hit-pay.com/v1'

    const hitpayRes = await fetch(`${hitpayBase}/payment-requests`, {
      method: 'POST',
      headers: {
        'X-BUSINESS-API-KEY': process.env.HITPAY_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: grandTotal.toFixed(2),
        currency: 'PHP',
        purpose: `Sensarè ${product.name} x${qty}`,
        reference_number: refNum,
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/order/confirm?ref=${refNum}`,
        webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/hitpay`,
        allow_repeated_payments: false,
      }),
    })

    if (!hitpayRes.ok) {
      const err = await hitpayRes.text()
      console.error('HitPay error:', err)
      return NextResponse.json({ error: 'Payment setup failed' }, { status: 500 })
    }

    const hitpay = await hitpayRes.json()

    // Create pending order
    await supabaseAdmin().from('sensare_orders').insert({
      reference_number: refNum,
      customer_name: 'Pending',
      customer_email: 'pending@sensare.com',
      shipping_address: {},
      items: [{ product_id: productId, product_name: product.name, qty, unit_price: product.price_php }],
      subtotal_php: total,
      shipping_php: shipping,
      total_php: grandTotal,
      payment_status: 'pending',
      hitpay_payment_id: hitpay.id,
    })

    return NextResponse.json({ url: hitpay.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
