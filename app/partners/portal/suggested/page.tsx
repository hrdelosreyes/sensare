import Link from 'next/link'
import { requireApprovedPartnerPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getLocations, getPartnerCatalog } from '@/lib/partner-data'
import { getForecastSettings } from '@/lib/forecast'
import { addDays, fmtDate, locationLabel, manilaToday, peso } from '@/lib/partner'
import { ConfirmButton } from '@/components/portal/forms'
import { dismissSuggestionAction, refreshSuggestionAction } from '../actions'
import ApproveForm from './ApproveForm'

type Line = {
  id: string; location_id: string; product_id: string; suggested_cases: number; case_size: number
  on_hand: number; on_order: number; avg_daily: number; trend_pct: number | null; days_cover: number | null; stockout_date: string | null
}

export default async function SuggestedOrderPage() {
  const partner = await requireApprovedPartnerPage()
  const db = supabaseAdmin()
  const [{ data: s }, locations, catalog, cfg, { data: history }] = await Promise.all([
    db.from('sensare_partner_order_suggestions').select('*, sensare_partner_order_suggestion_lines(*)')
      .eq('partner_id', partner.id).eq('status', 'open').maybeSingle(),
    getLocations(partner.id, false),
    getPartnerCatalog(partner.id),
    getForecastSettings(),
    db.from('sensare_partner_order_suggestions').select('id, status, generated_at, decided_at, order_group_id')
      .eq('partner_id', partner.id).neq('status', 'open').neq('status', 'superseded').order('generated_at', { ascending: false }).limit(5),
  ])
  const locName = new Map(locations.map(l => [l.id, locationLabel(l)]))
  const price = new Map(catalog.map(c => [c.id, c]))
  const lines = ((s?.sensare_partner_order_suggestion_lines ?? []) as Line[]).filter(l => price.has(l.product_id))
  const byLoc = new Map<string, Line[]>()
  for (const l of lines) byLoc.set(l.location_id, [...(byLoc.get(l.location_id) ?? []), l])
  const total = lines.reduce((t, l) => t + l.suggested_cases * (price.get(l.product_id)?.effective_case_price ?? 0), 0)
  const arrival = addDays(manilaToday(), cfg.leadTimeDays)

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="pp-h1">Suggested order</h1>
          <p className="pp-muted" style={{ maxWidth: 720 }}>
            We prepare this automatically from each branch&apos;s sales over the last 4 weeks (recent weeks count more, rising sales are followed right away),
            your current stock and orders already on the way. It assumes about {cfg.leadTimeDays} days for delivery and orders enough to last {cfg.coverDays} days
            after arrival, plus a {cfg.safetyDays}-day safety buffer.
          </p>
        </div>
        <form action={refreshSuggestionAction}><button className="pp-btn pp-btn-ghost pp-btn-sm" type="submit">Recalculate now</button></form>
      </div>

      {!s || lines.length === 0 ? (
        <div className="pp-card">
          <p className="pp-h2">Nothing to reorder right now</p>
          <p className="pp-muted">Every branch has enough stock (including orders on the way) to cover the delivery lead time. We&apos;ll prepare a suggestion and email you as soon as a reorder is needed. Keep recording daily sales so the forecast stays accurate.</p>
        </div>
      ) : (
        <>
          <div className="pp-alert pp-alert-info" style={{ marginBottom: 0 }}>
            Updated {fmtDate(s.generated_at)}. If you approve today, delivery is expected around <strong>{fmtDate(arrival)}</strong>.
          </div>
          {[...byLoc.entries()].map(([locId, ls]) => (
            <div key={locId} className="pp-card">
              <p className="pp-h2">{locName.get(locId) ?? 'Branch'}</p>
              <div className="pp-table-wrap">
                <table className="pp-table">
                  <thead><tr><th>Product</th><th className="pp-num">On hand</th><th className="pp-num">On the way</th><th className="pp-num">Forecast / day</th><th className="pp-num">Trend</th><th>Runs out</th><th className="pp-num">Suggested</th><th className="pp-num">Amount</th></tr></thead>
                  <tbody>
                    {ls.map(l => {
                      const p = price.get(l.product_id)!
                      const late = l.stockout_date && l.stockout_date < arrival
                      return (
                        <tr key={l.id}>
                          <td>{p.name}</td>
                          <td className="pp-num">{l.on_hand}</td>
                          <td className="pp-num">{l.on_order || '—'}</td>
                          <td className="pp-num">{Number(l.avg_daily).toFixed(1)}</td>
                          <td className="pp-num">{l.trend_pct === null ? '—' : `${Number(l.trend_pct) > 0 ? '▲' : Number(l.trend_pct) < 0 ? '▼' : ''} ${Math.abs(Math.round(Number(l.trend_pct)))}%`}</td>
                          <td>{fmtDate(l.stockout_date)}{late && <><br /><span className="pp-badge pp-badge-bad">before delivery</span></>}</td>
                          <td className="pp-num"><strong style={{ color: 'var(--cream)' }}>{l.suggested_cases} cs</strong><br /><span className="pp-muted" style={{ fontSize: 12 }}>{l.suggested_cases * l.case_size} boxes</span></td>
                          <td className="pp-num">{peso(l.suggested_cases * (p.effective_case_price ?? 0), 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="pp-card">
            <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="pp-h2" style={{ marginBottom: 4 }}>Total {peso(total, 0)}</p>
                <p className="pp-muted">{lines.reduce((t, l) => t + l.suggested_cases, 0)} cases · {byLoc.size} deliver{byLoc.size === 1 ? 'y' : 'ies'}</p>
              </div>
              <ApproveForm suggestionId={s.id} defaultTerms={partner.default_payment_terms} />
            </div>
            <div className="pp-row" style={{ marginTop: 16 }}>
              <Link href={`/partners/portal/order?suggestion=${s.id}`} className="pp-btn pp-btn-ghost pp-btn-sm">Adjust quantities first</Link>
              <form action={dismissSuggestionAction}>
                <input type="hidden" name="suggestion_id" value={s.id} />
                <ConfirmButton className="pp-btn pp-btn-ghost pp-btn-sm" message="Skip this suggestion? We'll prepare a fresh one in a couple of days if stock is still low.">Not now</ConfirmButton>
              </form>
            </div>
          </div>
        </>
      )}

      {(history?.length ?? 0) > 0 && (
        <div className="pp-card">
          <p className="pp-h3">Past suggestions</p>
          <table className="pp-table">
            <tbody>
              {history!.map(h => (
                <tr key={h.id}>
                  <td>{fmtDate(h.generated_at)}</td>
                  <td><span className={`pp-badge ${h.status === 'approved' ? 'pp-badge-ok' : 'pp-badge-mute'}`}>{h.status === 'dismissed' ? 'skipped' : h.status}</span></td>
                  <td>{h.order_group_id && <Link className="pp-link" href={`/partners/portal/orders?placed=${h.order_group_id}`}>View orders</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
