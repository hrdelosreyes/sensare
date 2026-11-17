import { requireApprovedPartnerPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { getLocations } from '@/lib/partner-data'
import { locationAddress } from '@/lib/partner'
import { setDefaultLocationAction } from '../actions'
import { LocationForm, ToggleLocation } from './forms'

export default async function BranchesPage() {
  const partner = await requireApprovedPartnerPage()
  const [locations, stock] = await Promise.all([
    getLocations(partner.id, false),
    db()<{ location_id: string; on_hand: number }[]>`select location_id, on_hand from sensare_partner_stock where partner_id = ${partner.id}`,
  ])
  const units = new Map<string, number>()
  for (const s of stock) units.set(s.location_id, (units.get(s.location_id) ?? 0) + Number(s.on_hand))
  const active = locations.filter(l => l.is_active)
  const closed = locations.filter(l => !l.is_active)

  return (
    <div className="pp-stack">
      <div>
        <h1 className="pp-h1">Branches & delivery locations</h1>
        <p className="pp-muted">Each branch keeps its own inventory and daily sales. When you order, you can split cases across branches — each branch gets its own delivery.</p>
      </div>
      <div className="pp-grid-2">
        {active.map(l => (
          <div key={l.id} className="pp-card">
            <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <p className="pp-h2" style={{ marginBottom: 0 }}>{l.name}</p>
              <div className="pp-row">
                <span className="pp-badge pp-badge-mute">{units.get(l.id) ?? 0} boxes</span>
                {l.is_default
                  ? <span className="pp-badge">Default</span>
                  : <form action={setDefaultLocationAction}><input type="hidden" name="location_id" value={l.id} /><button className="pp-btn pp-btn-ghost pp-btn-sm" type="submit">Make default</button></form>}
              </div>
            </div>
            <p className="pp-muted" style={{ marginBottom: 12 }}>{locationAddress(l) || 'No address yet'}{l.contact_name || l.phone ? ` · ${[l.contact_name, l.phone].filter(Boolean).join(', ')}` : ''}</p>
            <details>
              <summary className="pp-link" style={{ cursor: 'pointer', fontSize: 14, marginBottom: 12 }}>Edit branch</summary>
              <LocationForm location={l} />
              {!l.is_default && <ToggleLocation id={l.id} active={false} />}
            </details>
          </div>
        ))}
        <div className="pp-card">
          <p className="pp-h2">Add a branch</p>
          <LocationForm />
        </div>
      </div>
      {closed.length > 0 && (
        <div className="pp-card">
          <p className="pp-h3">Closed branches</p>
          {closed.map(l => (
            <div key={l.id} className="pp-row" style={{ justifyContent: 'space-between', padding: '8px 0' }}>
              <span>{l.name} <span className="pp-muted">· {locationAddress(l)}</span></span>
              <ToggleLocation id={l.id} active />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
