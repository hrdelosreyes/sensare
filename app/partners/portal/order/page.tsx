import { requireApprovedPartnerPage } from '@/lib/auth'
import { getPartnerCatalog, getPartnerStock, getLowStockDays } from '@/lib/partner-data'
import OrderForm from './OrderForm'

export default async function NewOrderPage() {
  const partner = await requireApprovedPartnerPage()
  const [catalog, stock] = await Promise.all([
    getPartnerCatalog(partner.id),
    getLowStockDays().then(d => getPartnerStock(partner.id, d)),
  ])
  const suggestions = Object.fromEntries(stock.map(s => [s.product_id, { onHand: s.on_hand, suggested: s.suggested_cases }]))
  const address = [partner.address, partner.city, partner.province].filter(Boolean).join(', ')

  return (
    <div>
      <h1 className="pp-h1">New order</h1>
      <p className="pp-muted" style={{ marginBottom: 24 }}>All products are sold in cases. Prices shown are your partner prices. We&apos;ll confirm your order and any shipping fee before it ships.</p>
      {catalog.length === 0 ? (
        <div className="pp-alert pp-alert-warn">Your price list isn&apos;t set up yet. Please contact hello@mysensare.com and we&apos;ll get you ready to order.</div>
      ) : (
        <OrderForm
          catalog={catalog.map(p => ({ id: p.id, name: p.name, case_size: p.case_size, price: p.effective_case_price!, srp: Number(p.price_php) }))}
          defaultTerms={partner.default_payment_terms}
          defaultAddress={address}
          suggestions={suggestions}
        />
      )}
    </div>
  )
}
