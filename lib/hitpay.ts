import 'server-only'
import { db } from './db'
import type { Partner, PartnerOrder } from './partner'

export const PARTNER_REF_PREFIX = 'spo_'

function hitpayBase() {
  return process.env.NEXT_PUBLIC_HITPAY_MODE === 'live'
    ? 'https://api.hit-pay.com/v1'
    : 'https://api.sandbox.hit-pay.com/v1'
}

// Low-level: create a HitPay payment request. The webhook (app/api/webhooks/hitpay)
// confirms payment using `reference`.
export async function createHitpayRequest({ reference, amount, purpose, partner, returnPath }: {
  reference: string; amount: number; purpose: string; partner: Pick<Partner, 'email' | 'business_name'>; returnPath: string
}): Promise<{ id: string; url: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const res = await fetch(`${hitpayBase()}/payment-requests`, {
    method: 'POST',
    headers: { 'X-BUSINESS-API-KEY': process.env.HITPAY_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amount.toFixed(2),
      currency: 'PHP',
      purpose,
      reference_number: reference,
      email: partner.email,
      name: partner.business_name,
      redirect_url: `${appUrl}${returnPath}`,
      webhook: `${appUrl}/api/webhooks/hitpay`,
      allow_repeated_payments: false,
    }),
  })
  if (!res.ok) throw new Error(`HitPay ${res.status}: ${await res.text()}`)
  const hitpay = await res.json()
  return { id: hitpay.id as string, url: hitpay.url as string }
}

// Online payment for (part of) one partner order; records a pending payment.
export async function createHitpayPayment({ order, partner, amount, returnPath }: {
  order: PartnerOrder; partner: Partner; amount: number; returnPath: string
}): Promise<string> {
  const reference = `${PARTNER_REF_PREFIX}${order.id.slice(0, 8)}_${Date.now()}`
  const hitpay = await createHitpayRequest({ reference, amount, purpose: `Sensarè partner order ${order.order_number}`, partner, returnPath })
  await db()`insert into sensare_partner_payments ${db()({
    order_id: order.id, partner_id: partner.id, amount_php: amount, method: 'hitpay',
    status: 'pending', reference, hitpay_payment_id: hitpay.id,
  })}`
  return hitpay.url
}
