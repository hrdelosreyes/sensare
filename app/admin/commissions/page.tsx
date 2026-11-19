import { requireAdminPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtDate, peso, PAYMENT_METHOD, type PaymentMethod } from '@/lib/partner'
import { redirect } from 'next/navigation'
import { can, homeFor } from '@/lib/roles'
import PrintButton from '@/components/portal/PrintButton'

// Commission is earned on payments confirmed in the month, at the rate
// recorded when each payment was confirmed.
function monthBounds(ym: string | undefined) {
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()).slice(0, 7)
  const m = ym && /^\d{4}-\d{2}$/.test(ym) ? ym : now
  const [y, mo] = m.split('-').map(Number)
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
  return { month: m, from: `${m}-01`, to: `${next}-01` }
}

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ month?: string; am?: string }> }) {
  const admin = await requireAdminPage()
  const all = can(admin.role, 'commissions.view_all')
  if (!all && !can(admin.role, 'commissions.view_own')) redirect(homeFor(admin.role))
  const sp = await searchParams
  const { month, from, to } = monthBounds(sp.month)
  const sql = db()
  const amFilter = all ? (sp.am && /^[0-9a-f-]{36}$/i.test(sp.am) ? sp.am : null) : admin.user_id

  const [byAm, lines, managers] = await Promise.all([
    sql<{ user_id: string; name: string | null; email: string; rate: number | null; collected: number; commission: number; payments: number }[]>`
      select a.user_id, a.name, a.email, a.commission_pct as rate,
        coalesce(sum(x.amount_php), 0) as collected, coalesce(sum(x.commission_php), 0) as commission, count(x.id)::int as payments
      from sensare_admins a
      left join sensare_partner_payments x on x.account_manager_id = a.user_id and x.status = 'confirmed'
        and x.confirmed_at >= (${from}::date::timestamp at time zone 'Asia/Manila')
        and x.confirmed_at < (${to}::date::timestamp at time zone 'Asia/Manila')
      where a.role = 'account_manager' ${amFilter ? sql`and a.user_id = ${amFilter}` : sql``}
      group by a.user_id order by commission desc, a.name`,
    sql<{ id: string; confirmed_at: string; amount_php: number; commission_pct: number; commission_php: number; method: PaymentMethod
          order_number: string; business_name: string; am_name: string | null }[]>`
      select x.id, x.confirmed_at, x.amount_php, x.commission_pct, x.commission_php, x.method, o.order_number, p.business_name,
        coalesce(a.name, a.email) as am_name
      from sensare_partner_payments x
      join sensare_partner_orders o on o.id = x.order_id
      join sensare_partners p on p.id = x.partner_id
      join sensare_admins a on a.user_id = x.account_manager_id
      where x.status = 'confirmed' and x.account_manager_id is not null
        and x.confirmed_at >= (${from}::date::timestamp at time zone 'Asia/Manila')
        and x.confirmed_at < (${to}::date::timestamp at time zone 'Asia/Manila')
        ${amFilter ? sql`and x.account_manager_id = ${amFilter}` : sql``}
      order by x.confirmed_at desc limit 500`,
    all ? sql<{ user_id: string; name: string | null; email: string }[]>`select user_id, name, email from sensare_admins where role = 'account_manager' order by name` : Promise.resolve([]),
  ])
  const total = byAm.reduce((t, r) => t + r.commission, 0)

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="pp-h1">{all ? 'Commissions' : 'My commission'}</h1>
          <p className="pp-muted">Earned on partner payments confirmed in the month, at the rate when each was confirmed. Return credits don’t count.</p>
        </div>
        <PrintButton />
      </div>
      <form method="get" className="pp-card pp-row no-print" style={{ alignItems: 'flex-end' }}>
        <label><span className="pp-label">Month</span><input className="pp-input" type="month" name="month" defaultValue={month} style={{ width: 'auto' }} /></label>
        {all && (
          <label><span className="pp-label">Account manager</span>
            <select className="pp-select" name="am" defaultValue={amFilter ?? ''} style={{ width: 'auto' }}>
              <option value="">All</option>
              {managers.map(m => <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>)}
            </select></label>
        )}
        <button className="pp-btn pp-btn-sm" type="submit">Show</button>
      </form>

      <div className="pp-card">
        <p className="pp-h2">{all ? `Total ${peso(total)}` : `Earned ${peso(total)}`}</p>
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead><tr><th>Account manager</th><th className="pp-num">Current rate</th><th className="pp-num">Payments</th><th className="pp-num">Collected</th><th className="pp-num">Commission</th></tr></thead>
            <tbody>{byAm.map(r => (
              <tr key={r.user_id}><td>{r.name || r.email}</td><td className="pp-num">{r.rate ?? 0}%</td><td className="pp-num">{r.payments}</td>
                <td className="pp-num">{peso(r.collected)}</td><td className="pp-num">{peso(r.commission)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="pp-card">
        <p className="pp-h3">Payments</p>
        {lines.length === 0 ? <p className="pp-empty">No confirmed payments this month.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Confirmed</th><th>Partner</th><th>Order</th>{all && <th>Account manager</th>}<th>Method</th><th className="pp-num">Amount</th><th className="pp-num">Rate</th><th className="pp-num">Commission</th></tr></thead>
              <tbody>{lines.map(l => (
                <tr key={l.id}><td>{fmtDate(l.confirmed_at)}</td><td>{l.business_name}</td><td>{l.order_number}</td>{all && <td>{l.am_name}</td>}
                  <td>{PAYMENT_METHOD[l.method]}</td><td className="pp-num">{peso(l.amount_php)}</td><td className="pp-num">{l.commission_pct}%</td><td className="pp-num">{peso(l.commission_php)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
