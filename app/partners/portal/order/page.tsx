import { requireApprovedPartnerPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { getLocations, getPartnerCatalog } from '@/lib/partner-data'
import { getStockPlan } from '@/lib/forecast'
import { locationLabel } from '@/lib/partner'
import OrderForm from './OrderForm'

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ suggestion?: string }> }) {
  const partner = await requireApprovedPartnerPage()
  const sp = await searchParams
  const [catalog, locations] = await Promise.all([getPartnerCatalog(partner.id), getLocations(partner.id)])
  const plan = await getStockPlan(partner.id, undefined, locations)

  // Prefill from an open suggestion when asked.
  let suggestionId: string | null = null
  const initial: Record<string, number> = {}
  if (sp.suggestion) {
    const lines = /^[0-9a-f-]{36}$/i.test(sp.suggestion) ? await db()<{ location_id: string; product_id: string; suggested_cases: number }[]>`
      select l.location_id, l.product_id, l.suggested_cases from sensare_partner_order_suggestion_lines l
      join sensare_partner_order_suggestions s on s.id = l.suggestion_id
      where s.id = ${sp.suggestion} and s.partner_id = ${partner.id} and s.status = 'open'` : []
    if (lines.length) {
      suggestionId = sp.suggestion
      for (const l of lines) initial[`${l.location_id}_${l.product_id}`] = l.suggested_cases
    }
  }
  const stock = Object.fromEntries(plan.map(p => [`${p.location_id}_${p.product_id}`, { onHand: p.on_hand, onOrder: p.on_order, suggested: p.suggested_cases }]))

  return (
    <div>
      <h1 className="pp-h1">New order</h1>
      <p className="pp-muted" style={{ marginBottom: 24 }}>
        Products are sold in cases. Enter cases per branch — each branch gets its own delivery and invoice. Allow about 2 weeks for delivery.
      </p>
      {suggestionId && <div className="pp-alert pp-alert-info">Pre-filled from your suggested order. Adjust anything you like, then place the order.</div>}
      {catalog.length === 0 ? (
        <div className="pp-alert pp-alert-warn">Your price list isn&apos;t set up yet. Please contact mysensare@gmail.com and we&apos;ll get you ready to order.</div>
      ) : (
        <OrderForm
          catalog={catalog.map(p => ({ id: p.id, name: p.name, case_size: p.case_size, price: p.effective_case_price!, srp: Number(p.price_php) }))}
          locations={locations.map(l => ({ id: l.id, name: locationLabel(l) }))}
          defaultTerms={partner.default_payment_terms}
          stock={stock}
          initial={initial}
          suggestionId={suggestionId}
        />
      )}
    </div>
  )
}
