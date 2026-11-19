import { NextRequest, NextResponse } from 'next/server'
import { db, one } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { productId, qty = 1, customer } = await req.json()
    if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 50) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const c = cleanCustomer(customer)
    if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 })

    if (typeof productId !== 'string' || !/^[0-9a-f-]{36}$/i.test(productId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const product = await one(db()<{ name: string; price_php: number; stock_qty: number }[]>`
      select * from sensare_products where id = ${productId} and is_active`)

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (product.stock_qty < qty) return NextResponse.json({ error: 'Not enough stock' }, { status: 409 })

    const total = product.price_php * qty
    const shipping = total >= 1000 ? 0 : 100
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
        name: c.name,
        email: c.email,
        phone: c.phone,
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
    await db()`insert into sensare_orders ${db()({
      reference_number: refNum,
      customer_name: c.name,
      customer_email: c.email,
      customer_phone: c.phone,
      shipping_address: { address: c.address, city: c.city, province: c.province },
      notes: c.notes || null,
      items: [{ product_id: productId, product_name: product.name, qty, unit_price: product.price_php }],
      subtotal_php: total,
      shipping_php: shipping,
      total_php: grandTotal,
      payment_status: 'pending',
      hitpay_payment_id: hitpay.id,
    })}`

    return NextResponse.json({ url: hitpay.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type Customer = { name: string; email: string; phone: string; address: string; city: string; province: string; notes: string }

function cleanCustomer(raw: unknown): Customer | { error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const f = (k: string, max: number) => String(r[k] ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
  const c: Customer = {
    name: f('name', 120), email: f('email', 200).toLowerCase(), phone: f('phone', 30),
    address: f('address', 300), city: f('city', 100), province: f('province', 100),
    notes: String(r.notes ?? '').trim().slice(0, 500),
  }
  if (!c.name || !c.address || !c.city || !c.province) return { error: 'Please fill in your name and delivery address.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return { error: 'Please enter a valid email address.' }
  if (c.phone.replace(/\D/g, '').length < 10) return { error: 'Please enter a valid mobile number.' }
  return c
}
