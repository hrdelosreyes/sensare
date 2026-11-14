import 'server-only'
import { supabaseAdmin } from './supabase'
import type { Partner, PartnerOrder } from './partner'

export const PARTNER_REF_PREFIX = 'spo_'

function hitpayBase() {
  return process.env.NEXT_PUBLIC_HITPAY_MODE === 'live'
    ? 'https://api.hit-pay.com/v1'
    : 'https://api.sandbox.hit-pay.com/v1'
}

// Creates a HitPay payment request for (part of) a partner order and records a
// pending payment. The HitPay webhook confirms it (app/api/webhooks/hitpay).
export async function createHitpayPayment({ order, partner, amount, returnPath }: {
  order: PartnerOrder; partner: Partner; amount: number; returnPath: string
}): Promise<string> {
  const reference = `${PARTNER_REF_PREFIX}${order.id.slice(0, 8)}_${Date.now()}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const res = await fetch(`${hitpayBase()}/payment-requests`, {
    method: 'POST',
    headers: { 'X-BUSINESS-API-KEY': process.env.HITPAY_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amount.toFixed(2),
      currency: 'PHP',
      purpose: `Sensarè partner order ${order.order_number}`,
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

  const { error } = await supabaseAdmin().from('sensare_partner_payments').insert({
    order_id: order.id,
    partner_id: partner.id,
    amount_php: amount,
    method: 'hitpay',
    status: 'pending',
    reference,
    hitpay_payment_id: hitpay.id,
  })
  if (error) throw new Error(`Could not record payment: ${error.message}`)
  return hitpay.url as string
}
