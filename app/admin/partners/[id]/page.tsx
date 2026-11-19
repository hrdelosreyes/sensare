import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'
import { db, one } from '@/lib/db'
import { getLocations, getPartnerCatalog } from '@/lib/partner-data'
import { getStockPlan } from '@/lib/forecast'
import StockTable from '@/components/portal/StockTable'
import { generateSuggestionAction } from '../../actions'
import { balance, BUSINESS_TYPES, fmtDate, isOverdue, locationAddress, locationLabel, peso, PAYMENT_TERMS, type Partner, type PartnerOrder } from '@/lib/partner'
import { OrderStatusBadge, PartnerStatusBadge, PaymentStatusBadge, Stat } from '@/components/portal/ui'
import { StatusForm, PartnerAdminForm, PriceListForm, AdminAdjustForm } from './forms'
import { can, ROLES } from '@/lib/roles'

export default async function AdminPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage('partners.view')
  const { id } = await params
  const sql = db()
  const partner = /^[0-9a-f-]{36}$/i.test(id)
    ? await one(sql<Partner[]>`select * from sensare_partners where id = ${id}
        ${admin.role === 'account_manager' ? sql`and account_manager_id = ${admin.user_id}` : sql``}`)
    : null
  if (!partner) notFound()
  const may = (p: Parameters<typeof can>[1]) => can(admin.role, p)
  const managers = may('partners.edit')
    ? await sql<{ user_id: string; name: string | null; email: string }[]>`
        select user_id, name, email from sensare_admins where role = 'account_manager' and is_active order by name`
    : []
  const am = partner.account_manager_id
    ? await one(sql<{ name: string | null; email: string; phone: string | null }[]>`select name, email, phone from sensare_admins where user_id = ${partner.account_manager_id}`)
    : null

  const locations = await getLocations(partner.id, false)
  const [catalog, stock, orders, suggestion, sugLines] = await Promise.all([
    getPartnerCatalog(partner.id, true),
    getStockPlan(partner.id, undefined, locations),
    sql<PartnerOrder[]>`select * from sensare_partner_orders where partner_id = ${partner.id} order by created_at desc limit 200`,
    one(sql<{ generated_at: string; notified_at: string | null }[]>`
      select generated_at, notified_at from sensare_partner_order_suggestions where partner_id = ${partner.id} and status = 'open'`),
    sql<{ suggested_cases: number; location_id: string }[]>`
      select l.suggested_cases, l.location_id from sensare_partner_order_suggestion_lines l
      join sensare_partner_order_suggestions s on s.id = l.suggestion_id
      where s.partner_id = ${partner.id} and s.status = 'open'`,
  ])
  const locName = new Map(locations.map(l => [l.id, locationLabel(l)]))
  const sugCases = sugLines.reduce((t, l) => t + l.suggested_cases, 0)
  const active = orders.filter(o => o.status !== 'cancelled')
  const outstanding = active.reduce((s, o) => s + balance(o), 0)
  const overdue = active.filter(isOverdue).reduce((s, o) => s + balance(o), 0)

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <p className="pp-muted"><Link href="/admin/partners" className="pp-link">← {admin.role === 'account_manager' ? 'My accounts' : 'Partners'}</Link></p>
          <h1 className="pp-h1">{partner.business_name}</h1>
          <div className="pp-row"><PartnerStatusBadge status={partner.status} /><span className="pp-muted">Default terms: {PAYMENT_TERMS[partner.default_payment_terms]}</span>
            {am && <span className="pp-muted">· {ROLES.account_manager.label}: {am.name || am.email}</span>}</div>
        </div>
        {may('reports.view') && <Link href={`/admin/partner-reports?partner=${partner.id}`} className="pp-btn pp-btn-ghost pp-btn-sm">View reports</Link>}
      </div>

      {may('partners.approve') && <StatusForm partner={partner} />}

      {partner.status === 'approved' && (
        <div className="pp-grid">
          <Stat label="Boxes on hand" value={stock.reduce((t, r) => t + r.on_hand, 0)} sub={`${locations.filter(l => l.is_active).length} branch(es)`} />
          <Stat label="Orders" value={active.length} sub={may('money.view') ? `${peso(active.reduce((s, o) => s + Number(o.total_php), 0), 0)} total` : undefined} />
          {may('money.view') && <Stat label="Outstanding" value={peso(outstanding, 0)} sub={overdue ? `${peso(overdue, 0)} overdue` : undefined} />}
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
        {may('partners.edit') ? (
          <div className="pp-card">
            <p className="pp-h2">Account settings</p>
            <PartnerAdminForm partner={partner} managers={managers} />
          </div>
        ) : (
          <div className="pp-card">
            <p className="pp-h2">Account</p>
            <dl className="pp-dl">
              <dt>Default terms</dt><dd>{PAYMENT_TERMS[partner.default_payment_terms]}</dd>
              <dt>Consignment period</dt><dd>{partner.consignment_period_days} days</dd>
              <dt>Account manager</dt><dd>{am ? `${am.name || am.email}${am.phone ? ` · ${am.phone}` : ''}` : '—'}</dd>
            </dl>
          </div>
        )}
      </div>

      {may('partners.prices') ? (
        <div className="pp-card">
          <p className="pp-h2">Price list</p>
          <p className="pp-muted" style={{ marginBottom: 16 }}>Set this partner&apos;s case price per product. Leave blank to use the default wholesale price (Partner Settings). Untick to hide a product from this partner.</p>
          <PriceListForm partnerId={partner.id} items={catalog.map(c => ({
            id: c.id, name: c.name, case_size: c.case_size, srp: Number(c.price_php),
            custom: c.custom_price, fallback: c.wholesale_case_price_php != null ? Number(c.wholesale_case_price_php) : null, available: c.available,
          }))} />
        </div>
      ) : may('money.view') && (
        <div className="pp-card">
          <p className="pp-h2">Price list</p>
          <table className="pp-table">
            <thead><tr><th>Product</th><th className="pp-num">Case price</th><th className="pp-num">Per box</th><th>Available</th></tr></thead>
            <tbody>{catalog.map(c => (
              <tr key={c.id}><td>{c.name}</td>
                <td className="pp-num">{c.effective_case_price != null ? peso(c.effective_case_price, 0) : '—'}</td>
                <td className="pp-num">{c.effective_case_price != null ? peso(c.effective_case_price / c.case_size) : '—'}</td>
                <td>{c.available && c.effective_case_price != null ? 'Yes' : 'No'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="pp-card">
        <p className="pp-h2">Inventory by branch</p>
        {stock.length === 0 ? <p className="pp-empty">No stock yet.</p> : locations.filter(l => stock.some(x => x.location_id === l.id)).map(l => (
          <div key={l.id} style={{ marginBottom: 16 }}>
            {locations.length > 1 && <p className="pp-h3">{locName.get(l.id)}</p>}
            <StockTable rows={stock.filter(x => x.location_id === l.id)} />
          </div>
        ))}
        {may('partners.edit') && <><p className="pp-h3" style={{ marginTop: 12 }}>Adjust stock</p>
        <AdminAdjustForm partnerId={partner.id} options={locations.filter(l => l.is_active).flatMap(l => catalog.map(c => ({ key: `${l.id}|${c.id}`, label: `${locations.length > 1 ? `${locName.get(l.id)} — ` : ''}${c.name}` })))} /></>}
      </div>

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Branches</p>
          <table className="pp-table">
            <tbody>
              {locations.map(l => (
                <tr key={l.id}>
                  <td>{l.name}{l.is_default && <span className="pp-badge" style={{ marginLeft: 6 }}>default</span>}{!l.is_active && <span className="pp-badge pp-badge-mute" style={{ marginLeft: 6 }}>closed</span>}
                    <br /><span className="pp-muted" style={{ fontSize: 12 }}>{locationAddress(l)}{l.contact_name || l.phone ? ` · ${[l.contact_name, l.phone].filter(Boolean).join(', ')}` : ''}</span></td>
                  <td className="pp-num">{stock.filter(x => x.location_id === l.id).reduce((t, x) => t + x.on_hand, 0)} boxes</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pp-h3" style={{ marginTop: 20 }}>Suggested order</p>
          {suggestion && sugCases > 0
            ? <p className="pp-text" style={{ marginBottom: 10 }}>Open: <strong>{sugCases} cases</strong> across {new Set(sugLines.map(l => l.location_id)).size} branch(es), updated {fmtDate(suggestion.generated_at)}{suggestion.notified_at ? ' · partner emailed' : ''}. Waiting for the partner to approve.</p>
            : <p className="pp-muted" style={{ marginBottom: 10 }}>No reorder needed right now.</p>}
          {may('partners.suggest') && <form action={generateSuggestionAction} className="pp-row">
            <input type="hidden" name="partner_id" value={partner.id} />
            <label className="pp-row pp-muted" style={{ gap: 6 }}><input type="checkbox" name="notify" /> Email partner if a new suggestion opens</label>
            <button className="pp-btn pp-btn-ghost pp-btn-sm" type="submit">Recalculate now</button>
          </form>}
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
                    {may('money.view') && <td className="pp-num">{peso(o.total_php, 0)}</td>}
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
