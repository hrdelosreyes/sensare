import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getLocations } from '@/lib/partner-data'
import { getConsignmentState, previewSettlement } from '@/lib/consignment'
import { balance, fmtDate, isIsoDate, locationLabel, manilaToday, peso, PAYMENT_METHOD, type Partner, type PartnerOrder, type Settlement } from '@/lib/partner'
import { ConfirmButton } from '@/components/portal/forms'
import SettlementPreview, { periodLabel } from '@/components/portal/SettlementPreview'
import { reviewSettlementAction } from '../actions'
import RecordSettlementForm from './RecordSettlementForm'

export default async function AdminConsignmentPage({ searchParams }: { searchParams: Promise<{ partner?: string; to?: string }> }) {
  await requireAdminPage()
  const sp = await searchParams
  const db = supabaseAdmin()
  const today = manilaToday()
  const [{ data: settlementsData }, { data: consOrders }] = await Promise.all([
    db.from('sensare_partner_consignment_settlements').select('*, sensare_partners(business_name)')
      .neq('status', 'failed').order('created_at', { ascending: false }).limit(100),
    db.from('sensare_partner_orders').select('*, sensare_partners(*)').eq('payment_terms', 'consignment').eq('status', 'delivered'),
  ])
  const settlements = (settlementsData ?? []) as (Settlement & { sensare_partners: { business_name: string } | null })[]
  const pending = settlements.filter(s => s.status === 'pending' && s.method !== 'hitpay')

  // Partners with delivered consignment stock, and where their settlement stands.
  const byPartner = new Map<string, { partner: Partner; outstanding: number }>()
  for (const o of (consOrders ?? []) as (PartnerOrder & { sensare_partners: Partner })[]) {
    const v = byPartner.get(o.partner_id) ?? { partner: o.sensare_partners, outstanding: 0 }
    v.outstanding += balance(o)
    byPartner.set(o.partner_id, v)
  }
  const rows = await Promise.all([...byPartner.values()].map(async v => {
    const st = await getConsignmentState(v.partner)
    const lines = st.nextFrom && st.defaultTo ? await previewSettlement(v.partner.id, st.nextFrom, st.defaultTo) : []
    return { ...v, st, due: lines.reduce((s, l) => s + l.amount_php, 0) }
  }))
  rows.sort((a, b) => Number(b.st.isDue) - Number(a.st.isDue) || b.due - a.due)

  // Record-settlement panel for one partner.
  const sel = rows.find(r => r.partner.id === sp.partner)
  let selLines: Awaited<ReturnType<typeof previewSettlement>> = []
  let selTo: string | null = null
  let locName = new Map<string, string>()
  if (sel?.st.nextFrom) {
    selTo = isIsoDate(sp.to) && sp.to >= sel.st.nextFrom && sp.to <= today ? sp.to : sel.st.defaultTo
    if (selTo) selLines = await previewSettlement(sel.partner.id, sel.st.nextFrom, selTo)
    locName = new Map((await getLocations(sel.partner.id, false)).map(l => [l.id, locationLabel(l)]))
  }

  return (
    <div className="pp-stack">
      <div>
        <h1 className="pp-h1">Consignment</h1>
        <p className="pp-muted">Partners pay for consignment stock as it sells, settling their recorded sales every period (default 7 days, set per partner).</p>
      </div>

      {pending.length > 0 && (
        <div className="pp-card" style={{ borderColor: 'rgba(230,180,80,0.4)' }}>
          <p className="pp-h2">Bank transfers to verify</p>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Partner</th><th>Period</th><th>Reference</th><th>Sent</th><th className="pp-num">Amount</th><th></th></tr></thead>
              <tbody>
                {pending.map(s => (
                  <tr key={s.id}>
                    <td>{s.sensare_partners?.business_name}</td><td>{periodLabel(s.period_from, s.period_to)}</td><td>{s.reference}</td><td>{fmtDate(s.paid_on)}</td>
                    <td className="pp-num">{peso(s.amount_php)}</td>
                    <td>
                      <div className="pp-row" style={{ gap: 6 }}>
                        <form action={reviewSettlementAction}><input type="hidden" name="settlement_id" value={s.id} /><input type="hidden" name="decision" value="confirmed" />
                          <ConfirmButton message={`Confirm ${peso(s.amount_php)} was received?`}>Confirm</ConfirmButton></form>
                        <form action={reviewSettlementAction}><input type="hidden" name="settlement_id" value={s.id} /><input type="hidden" name="decision" value="rejected" />
                          <ConfirmButton className="pp-btn pp-btn-sm pp-btn-danger" message="Reject this transfer? The period reopens for the partner to settle again.">Reject</ConfirmButton></form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="pp-card">
        <p className="pp-h2">Partners on consignment</p>
        {rows.length === 0 ? <p className="pp-empty">No consignment stock has been delivered yet.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Partner</th><th>Period</th><th>Next period</th><th className="pp-num">Sold, unsettled</th><th className="pp-num">Unpaid stock</th><th></th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.partner.id} style={r.partner.id === sp.partner ? { background: 'rgba(201,144,106,0.08)' } : undefined}>
                    <td><Link className="pp-link" href={`/admin/partners/${r.partner.id}`}>{r.partner.business_name}</Link></td>
                    <td>{r.st.periodDays} days</td>
                    <td>{r.st.nextFrom && r.st.defaultTo ? periodLabel(r.st.nextFrom, r.st.defaultTo) : 'Settled to date'}{r.st.isDue && <span className="pp-badge pp-badge-warn" style={{ marginLeft: 8 }}>Due</span>}</td>
                    <td className="pp-num">{peso(r.due, 0)}</td>
                    <td className="pp-num">{peso(r.outstanding, 0)}</td>
                    <td>{r.st.nextFrom && <Link className="pp-btn pp-btn-ghost pp-btn-sm" href={`/admin/consignment?partner=${r.partner.id}`}>Record payment</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sel && sel.st.nextFrom && selTo && (
        <div className="pp-card" id="record">
          <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <p className="pp-h2" style={{ marginBottom: 0 }}>Record settlement · {sel.partner.business_name}</p>
            <form method="get" className="pp-row">
              <input type="hidden" name="partner" value={sel.partner.id} />
              <span className="pp-muted">{fmtDate(sel.st.nextFrom)} to</span>
              <input className="pp-input" type="date" name="to" defaultValue={selTo} min={sel.st.nextFrom} max={today} style={{ width: 'auto' }} />
              <button className="pp-btn pp-btn-ghost pp-btn-sm" type="submit">Update</button>
            </form>
          </div>
          {selLines.length === 0 ? <p className="pp-empty">No consignment sales recorded in this period.</p> : (
            <>
              <SettlementPreview lines={selLines} locName={locName} />
              <RecordSettlementForm partnerId={sel.partner.id} to={selTo} amount={selLines.reduce((s, l) => s + l.amount_php, 0)} today={today} />
            </>
          )}
        </div>
      )}

      <div className="pp-card">
        <p className="pp-h3">Recent settlements</p>
        {settlements.length === 0 ? <p className="pp-empty">None yet.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Partner</th><th>Period</th><th>Method</th><th>Reference</th><th>Status</th><th className="pp-num">Boxes</th><th className="pp-num">Amount</th></tr></thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.id}>
                    <td>{s.sensare_partners?.business_name}</td><td>{periodLabel(s.period_from, s.period_to)}</td><td>{PAYMENT_METHOD[s.method]}</td><td>{s.reference || '—'}</td>
                    <td><span className={`pp-badge ${s.status === 'confirmed' ? 'pp-badge-ok' : s.status === 'pending' ? 'pp-badge-warn' : 'pp-badge-bad'}`}>{s.status}</span></td>
                    <td className="pp-num">{s.units}</td><td className="pp-num">{peso(s.amount_php)}</td>
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
