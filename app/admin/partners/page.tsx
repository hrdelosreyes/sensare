import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtDate, manilaToday, peso, PAYMENT_TERMS, type Partner, type PartnerStatus } from '@/lib/partner'
import { can } from '@/lib/roles'
import { SITE_URL } from '@/lib/seo'
import { PartnerStatusBadge, Stat } from '@/components/portal/ui'
import CopyLink from '@/components/portal/CopyLink'

const FILTERS: { key: PartnerStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' },
  { key: 'suspended', label: 'Suspended' }, { key: 'rejected', label: 'Rejected' }, { key: 'all', label: 'All' },
]

type Row = Partner & {
  am_name: string | null; balance: number; overdue: number; open_orders: number; last_sale: string | null
}

export default async function AdminPartnersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const admin = await requireAdminPage('partners.view')
  const isAm = admin.role === 'account_manager'
  const showMoney = can(admin.role, 'money.view')
  const sp = await searchParams
  const sql = db()
  const today = manilaToday()
  const partners = await sql<Row[]>`
    select p.*, a.name as am_name,
      coalesce((select sum(greatest(o.total_php - o.amount_paid_php, 0)) from sensare_partner_orders o
                where o.partner_id = p.id and o.status <> 'cancelled'), 0) as balance,
      coalesce((select sum(greatest(o.total_php - o.amount_paid_php, 0)) from sensare_partner_orders o
                where o.partner_id = p.id and o.status <> 'cancelled' and o.payment_status <> 'paid' and o.due_date < ${today}::date), 0) as overdue,
      (select count(*) from sensare_partner_orders o where o.partner_id = p.id and o.status in ('submitted', 'confirmed', 'shipped'))::int as open_orders,
      (select max(sale_date) from sensare_partner_sales s where s.partner_id = p.id) as last_sale
    from sensare_partners p
    left join sensare_admins a on a.user_id = p.account_manager_id
    where ${isAm ? sql`p.account_manager_id = ${admin.user_id}` : sql`true`}
    order by p.created_at desc limit 2000`

  const counts = partners.reduce<Record<string, number>>((c, p) => ({ ...c, [p.status]: (c[p.status] ?? 0) + 1 }), {})
  const status = (sp.status as PartnerStatus | 'all') ?? (counts.pending && !isAm ? 'pending' : isAm ? 'all' : 'approved')
  const q = (sp.q ?? '').toLowerCase().trim()
  const shown = partners
    .filter(p => status === 'all' || p.status === status)
    .filter(p => !q || [p.business_name, p.contact_name, p.email, p.city, p.am_name].some(v => v?.toLowerCase().includes(q)))

  let commission: { month: number; pending: number } | null = null
  if (isAm) {
    const [c] = await sql<{ month: number; pending: number }[]>`
      select
        coalesce((select sum(commission_php) from sensare_partner_payments
          where account_manager_id = ${admin.user_id} and status = 'confirmed'
            and confirmed_at >= date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'), 0) as month,
        coalesce((select sum(x.amount_php) from sensare_partner_payments x join sensare_partners p on p.id = x.partner_id
          where p.account_manager_id = ${admin.user_id} and x.status = 'pending' and x.method <> 'hitpay'), 0) as pending`
    commission = c
  }
  const active = partners.filter(p => p.status === 'approved')

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="pp-h1">{isAm ? 'My accounts' : 'Partners'}</h1>
          <p className="pp-muted">{counts.approved ?? 0} active · {counts.pending ?? 0} awaiting review</p>
        </div>
        <form method="get" className="pp-row">
          <input type="hidden" name="status" value={status} />
          <input className="pp-input" name="q" defaultValue={sp.q} placeholder="Search name, email, city" style={{ width: 240, maxWidth: '100%' }} />
          <button className="pp-btn pp-btn-sm" type="submit">Search</button>
        </form>
      </div>

      {isAm && (
        <>
          <div className="pp-grid">
            <Stat label="Active accounts" value={active.length} />
            <Stat label="Balance due" value={peso(active.reduce((t, p) => t + p.balance, 0), 0)}
              sub={`${peso(active.reduce((t, p) => t + p.overdue, 0), 0)} overdue`} />
            <Stat label="Commission this month" value={peso(commission?.month ?? 0, 0)} sub={`${admin.commission_pct ?? 0}% of confirmed collections`} />
            <Stat label="Collections to confirm" value={peso(commission?.pending ?? 0, 0)} sub="logged, awaiting Finance" />
          </div>
          {admin.referral_code && (
            <div className="pp-card">
              <p className="pp-h3">Your partner sign-up link</p>
              <p className="pp-muted" style={{ marginBottom: 12 }}>Partners who apply with this link — or that you sign up on your phone with it — are assigned to you automatically. An Owner or Manager approves them.</p>
              <CopyLink url={`${SITE_URL}/partners/apply?ref=${admin.referral_code}`} />
            </div>
          )}
        </>
      )}

      <div className="pp-row">
        {FILTERS.map(f => (
          <Link key={f.key} href={`/admin/partners?status=${f.key}`} className={`pp-btn pp-btn-sm ${status === f.key ? '' : 'pp-btn-ghost'}`}>
            {f.label}{f.key !== 'all' && counts[f.key] ? ` (${counts[f.key]})` : ''}
          </Link>
        ))}
      </div>
      <div className="pp-card">
        {shown.length === 0 ? <p className="pp-empty">{isAm && !partners.length ? 'No accounts assigned to you yet. Share your sign-up link to open one.' : 'No partners here.'}</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr>
                <th>Business</th><th>Location</th><th>Status</th>
                {!isAm && <th>Account manager</th>}
                <th className="pp-num">Open orders</th>
                {showMoney && <><th className="pp-num">Balance</th><th className="pp-num">Overdue</th></>}
                <th>Last sale</th><th>Terms</th>
              </tr></thead>
              <tbody>
                {shown.map(p => (
                  <tr key={p.id}>
                    <td><Link className="pp-link" href={`/admin/partners/${p.id}`}>{p.business_name}</Link><br /><span className="pp-muted" style={{ fontSize: 12 }}>{p.contact_name} · {p.email}</span></td>
                    <td>{[p.city, p.province].filter(Boolean).join(', ')}</td>
                    <td><PartnerStatusBadge status={p.status} /></td>
                    {!isAm && <td>{p.am_name ?? <span className="pp-muted">—</span>}</td>}
                    <td className="pp-num">{p.open_orders || '—'}</td>
                    {showMoney && <>
                      <td className="pp-num">{p.balance ? peso(p.balance, 0) : '—'}</td>
                      <td className="pp-num" style={{ color: p.overdue > 0 ? '#e09a9a' : undefined }}>{p.overdue ? peso(p.overdue, 0) : '—'}</td>
                    </>}
                    <td>{fmtDate(p.last_sale)}</td>
                    <td>{PAYMENT_TERMS[p.default_payment_terms]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
