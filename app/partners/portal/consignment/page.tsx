import { requireApprovedPartnerPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getLocations, getSetting } from '@/lib/partner-data'
import { getConsignmentState, previewSettlement } from '@/lib/consignment'
import { balance, fmtDate, isIsoDate, locationLabel, manilaToday, peso, PAYMENT_METHOD, type PartnerOrder, type Settlement } from '@/lib/partner'
import SettlementPreview, { periodLabel } from '@/components/portal/SettlementPreview'
import SettlePanel from './SettlePanel'

export default async function ConsignmentPage({ searchParams }: { searchParams: Promise<{ to?: string; paid?: string }> }) {
  const partner = await requireApprovedPartnerPage()
  const sp = await searchParams
  const today = manilaToday()
  const db = supabaseAdmin()
  const [state, locations, bank, { data: settlementsData }, { data: ordersData }] = await Promise.all([
    getConsignmentState(partner),
    getLocations(partner.id, false),
    getSetting('partner_bank_details'),
    db.from('sensare_partner_consignment_settlements').select('*').eq('partner_id', partner.id).order('period_to', { ascending: false }).limit(30),
    db.from('sensare_partner_orders').select('*').eq('partner_id', partner.id).eq('payment_terms', 'consignment').neq('status', 'cancelled').order('created_at'),
  ])
  const settlements = (settlementsData ?? []) as Settlement[]
  const orders = (ordersData ?? []) as PartnerOrder[]
  const locName = new Map(locations.map(l => [l.id, locationLabel(l)]))

  const from = state.nextFrom
  const to = from && isIsoDate(sp.to) && sp.to >= from && sp.to <= today ? sp.to : state.defaultTo
  const lines = from && to ? await previewSettlement(partner.id, from, to) : []
  const amount = lines.reduce((s, l) => s + l.amount_php, 0)
  const outstanding = orders.reduce((s, o) => s + balance(o), 0)
  const pending = settlements.filter(s => s.status === 'pending')

  return (
    <div className="pp-stack">
      <div>
        <h1 className="pp-h1">Consignment</h1>
        <p className="pp-muted" style={{ maxWidth: 720 }}>
          With consignment you pay only for boxes you&apos;ve sold. Every {state.periodDays === 7 ? 'week' : `${state.periodDays} days`}, settle the sales you recorded for that period — we work out the amount from your daily sales and your consignment prices.
        </p>
      </div>
      {state.pendingOnline && !sp.paid && <div className="pp-alert pp-alert-warn" style={{ marginBottom: 0 }}>An online payment was started but not confirmed yet. If you completed it, please wait a few minutes. Paying again below cancels the unfinished one.</div>}
      {sp.paid && <div className="pp-alert pp-alert-ok" style={{ marginBottom: 0 }}>Thanks! Your payment is being processed — it will show as confirmed once HitPay notifies us.</div>}

      <div className="pp-grid">
        <div className="pp-stat"><p className="pp-stat-label">Unpaid consignment</p><p className="pp-stat-value">{peso(outstanding, 0)}</p><p className="pp-stat-sub">delivered stock not yet settled</p></div>
        <div className="pp-stat"><p className="pp-stat-label">Settle every</p><p className="pp-stat-value">{state.periodDays} days</p></div>
        <div className="pp-stat"><p className="pp-stat-label">Last settled</p><p className="pp-stat-value" style={{ fontSize: 18 }}>{state.lastSettlement ? periodLabel(state.lastSettlement.period_from, state.lastSettlement.period_to) : '—'}</p></div>
      </div>

      {!state.hasConsignment ? (
        <div className="pp-card"><p className="pp-empty">No consignment stock has been delivered yet.</p></div>
      ) : !from || !to ? (
        <div className="pp-card"><p className="pp-muted">You&apos;re all settled up to today. Your next period starts tomorrow.</p></div>
      ) : (
        <div className="pp-card">
          <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p className="pp-h2" style={{ marginBottom: 4 }}>Settle {periodLabel(from, to)}</p>
              {state.isDue && <span className="pp-badge pp-badge-warn">Due</span>}
            </div>
            <form method="get" className="pp-row no-print">
              <label className="pp-row" style={{ gap: 8 }}><span className="pp-label" style={{ marginBottom: 0 }}>Period ends</span>
                <input className="pp-input" type="date" name="to" defaultValue={to} min={from} max={today} style={{ width: 'auto' }} /></label>
              <button className="pp-btn pp-btn-ghost pp-btn-sm" type="submit">Update</button>
            </form>
          </div>
          <p className="pp-hint" style={{ marginBottom: 14 }}>Starts the day after your last settlement, so no sales are missed or counted twice. Make sure all daily sales for the period are recorded first — they lock once you settle.</p>
          {lines.length === 0 ? <p className="pp-empty">No consignment sales recorded in this period.</p> : (
            <>
              <SettlementPreview lines={lines} locName={locName} />
              <SettlePanel to={to} amount={amount} bankDetails={bank} today={today} />
            </>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="pp-alert pp-alert-info" style={{ marginBottom: 0 }}>
          {pending.length} payment{pending.length > 1 ? 's are' : ' is'} awaiting confirmation.
        </div>
      )}

      {settlements.filter(s => s.status !== 'failed').length > 0 && (
        <div className="pp-card">
          <p className="pp-h3">Settlement history</p>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Period</th><th>Method</th><th>Reference</th><th>Status</th><th className="pp-num">Boxes</th><th className="pp-num">Amount</th></tr></thead>
              <tbody>
                {settlements.filter(s => s.status !== 'failed').map(s => (
                  <tr key={s.id}>
                    <td>{periodLabel(s.period_from, s.period_to)}</td>
                    <td>{PAYMENT_METHOD[s.method]}</td>
                    <td>{s.method === 'hitpay' ? '—' : s.reference || '—'}</td>
                    <td><span className={`pp-badge ${s.status === 'confirmed' ? 'pp-badge-ok' : s.status === 'pending' ? 'pp-badge-warn' : 'pp-badge-bad'}`}>{s.status === 'pending' ? 'Verifying' : s.status}</span></td>
                    <td className="pp-num">{s.units}</td>
                    <td className="pp-num">{peso(s.amount_php)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="pp-card">
          <p className="pp-h3">Consignment orders</p>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Order</th><th>Branch</th><th>Delivered</th><th className="pp-num">Value</th><th className="pp-num">Paid</th><th className="pp-num">Unpaid</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td><a className="pp-link" href={`/partners/portal/orders/${o.id}`}>{o.order_number}</a></td>
                    <td>{locName.get(o.location_id) ?? '—'}</td>
                    <td>{o.delivered_at ? fmtDate(o.delivered_at) : <span className="pp-muted">{o.status}</span>}</td>
                    <td className="pp-num">{peso(o.total_php, 0)}</td><td className="pp-num">{peso(o.amount_paid_php, 0)}</td><td className="pp-num">{peso(balance(o), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pp-hint" style={{ marginTop: 8 }}>Unsold boxes can be returned to Sensarè; we&apos;ll credit them against the order. Shipping fees, if any, are settled with your last settlement for that order.</p>
        </div>
      )}
    </div>
  )
}
