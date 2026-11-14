import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getLowStockDays, getPartnerCatalog, getPartnerStock } from '@/lib/partner-data'
import { balance, BUSINESS_TYPES, fmtDate, isOverdue, peso, PAYMENT_TERMS, type Partner, type PartnerOrder } from '@/lib/partner'
import { OrderStatusBadge, PartnerStatusBadge, PaymentStatusBadge, Stat } from '@/components/portal/ui'
import { StatusForm, PartnerAdminForm, PriceListForm, AdminAdjustForm } from './forms'

export default async function AdminPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const db = supabaseAdmin()
  const { data } = await db.from('sensare_partners').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const partner = data as Partner

  const lowDays = await getLowStockDays()
  const [catalog, stock, { data: ordersData }] = await Promise.all([
    getPartnerCatalog(partner.id, true),
    getPartnerStock(partner.id, lowDays),
    db.from('sensare_partner_orders').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(200),
  ])
  const orders = (ordersData ?? []) as PartnerOrder[]
  const active = orders.filter(o => o.status !== 'cancelled')
  const outstanding = active.reduce((s, o) => s + balance(o), 0)
  const overdue = active.filter(isOverdue).reduce((s, o) => s + balance(o), 0)

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <p className="pp-muted"><Link href="/admin/partners" className="pp-link">← Partners</Link></p>
          <h1 className="pp-h1">{partner.business_name}</h1>
          <div className="pp-row"><PartnerStatusBadge status={partner.status} /><span className="pp-muted">Default terms: {PAYMENT_TERMS[partner.default_payment_terms]}</span></div>
        </div>
        <Link href={`/admin/partner-reports?partner=${partner.id}`} className="pp-btn pp-btn-ghost pp-btn-sm">View reports</Link>
      </div>

      <StatusForm partner={partner} />

      {partner.status === 'approved' && (
        <div className="pp-grid">
          <Stat label="Units on hand" value={stock.reduce((s, r) => s + r.on_hand, 0)} />
          <Stat label="Orders" value={active.length} sub={`${peso(active.reduce((s, o) => s + Number(o.total_php), 0), 0)} total`} />
          <Stat label="Outstanding" value={peso(outstanding, 0)} sub={overdue ? `${peso(overdue, 0)} overdue` : undefined} />
        </div>
      )}

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Application</p>
          <dl className="pp-dl">
            <dt>Contact</dt><dd>{partner.contact_name}</dd>
            <dt>Email</dt><dd><a className="pp-link" href={`mailto:${partner.email}`}>{partner.email}</a></dd>
            <dt>Phone</dt><dd>{partner.phone || '—'}</dd>
            <dt>TIN</dt><dd>{partner.tin || '—'}</dd>
            <dt>Type</dt><dd>{partner.business_type ? BUSINESS_TYPES[partner.business_type] ?? partner.business_type : '—'}</dd>
            <dt>Address</dt><dd>{[partner.address, partner.city, partner.province].filter(Boolean).join(', ') || '—'}</dd>
            <dt>Sells via</dt><dd>{partner.sales_channels || '—'}</dd>
            <dt>Expected volume</dt><dd>{partner.expected_monthly_cases ? `${partner.expected_monthly_cases} cases / month` : '—'}</dd>
            <dt>Message</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{partner.message || '—'}</dd>
            <dt>Applied</dt><dd>{fmtDate(partner.created_at)}</dd>
            <dt>Last reviewed</dt><dd>{fmtDate(partner.reviewed_at)}</dd>
          </dl>
        </div>
        <div className="pp-card">
          <p className="pp-h2">Account settings</p>
          <PartnerAdminForm partner={partner} />
        </div>
      </div>

      <div className="pp-card">
        <p className="pp-h2">Price list</p>
        <p className="pp-muted" style={{ marginBottom: 16 }}>Set this partner&apos;s case price per product. Leave blank to use the default wholesale price (Partner Settings). Untick to hide a product from this partner.</p>
        <PriceListForm partnerId={partner.id} items={catalog.map(c => ({
          id: c.id, name: c.name, case_size: c.case_size, srp: Number(c.price_php),
          custom: c.custom_price, fallback: c.wholesale_case_price_php != null ? Number(c.wholesale_case_price_php) : null, available: c.available,
        }))} />
      </div>

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Inventory</p>
          {stock.length === 0 ? <p className="pp-empty">No stock yet.</p> : (
            <table className="pp-table">
              <thead><tr><th>Product</th><th className="pp-num">On hand</th><th className="pp-num">Sold 14d</th><th className="pp-num">Days left</th></tr></thead>
              <tbody>{stock.map(s => (
                <tr key={s.product_id}><td>{s.product_name}</td><td className="pp-num">{s.on_hand}</td><td className="pp-num">{s.sold_last_14}</td><td className="pp-num">{s.days_cover === null ? '—' : Math.floor(s.days_cover)}</td></tr>
              ))}</tbody>
            </table>
          )}
          <p className="pp-h3" style={{ marginTop: 20 }}>Adjust stock</p>
          <AdminAdjustForm partnerId={partner.id} products={catalog.map(c => ({ id: c.id, name: c.name }))} />
        </div>
        <div className="pp-card">
          <p className="pp-h2">Orders</p>
          {orders.length === 0 ? <p className="pp-empty">No orders yet.</p> : (
            <div className="pp-table-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}>
              <table className="pp-table">
                <tbody>{orders.map(o => (
                  <tr key={o.id}>
                    <td><Link className="pp-link" href={`/admin/partner-orders/${o.id}`}>{o.order_number}</Link><br /><span className="pp-muted" style={{ fontSize: 12 }}>{fmtDate(o.created_at)} · {PAYMENT_TERMS[o.payment_terms]}</span></td>
                    <td><OrderStatusBadge status={o.status} /></td>
                    <td>{o.status !== 'cancelled' && <PaymentStatusBadge status={o.payment_status} overdue={isOverdue(o)} />}</td>
                    <td className="pp-num">{peso(o.total_php, 0)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
