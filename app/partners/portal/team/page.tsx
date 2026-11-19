import { requireApprovedPartnerPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { getLocations } from '@/lib/partner-data'
import { fmtDate, locationLabel } from '@/lib/partner'
import { ConfirmButton } from '@/components/portal/forms'
import { removeMemberAction } from '../actions'
import { AddMemberForm, MemberForm } from './forms'

export type Member = { user_id: string; name: string | null; email: string; is_active: boolean; created_at: string; location_ids: string[]; last_login_at: string | null }

export default async function PartnerTeamPage() {
  const partner = await requireApprovedPartnerPage()
  const [locations, members] = await Promise.all([
    getLocations(partner.id),
    db()<Member[]>`
      select m.user_id, m.name, u.email, m.is_active, m.created_at, u.last_login_at,
        coalesce(array(select l.location_id from sensare_partner_member_locations l where l.user_id = m.user_id), '{}') as location_ids
      from sensare_partner_members m join sensare_users u on u.id = m.user_id
      where m.partner_id = ${partner.id} order by m.created_at`,
  ])
  const branches = locations.map(l => ({ id: l.id, name: locationLabel(l) }))
  return (
    <div className="pp-stack">
      <div>
        <h1 className="pp-h1">Team</h1>
        <p className="pp-muted">Give branch staff their own login to record daily sales and stock changes for their branch. They can&apos;t place orders or see prices, payments or reports.</p>
      </div>
      <div className="pp-card">
        <p className="pp-h2">Branch staff</p>
        {members.length === 0 ? <p className="pp-empty">No staff yet.</p> : members.map(m => (
          <div key={m.user_id} style={{ borderTop: '1px solid rgba(201,144,106,0.1)', padding: '16px 0' }}>
            <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <strong style={{ color: 'var(--cream)' }}>{m.name || m.email}</strong>
                {!m.is_active && <span className="pp-badge pp-badge-mute" style={{ marginLeft: 8 }}>inactive</span>}
                <br /><span className="pp-muted" style={{ fontSize: 13 }}>{m.email} · added {fmtDate(m.created_at)} · last login {fmtDate(m.last_login_at)}</span>
              </div>
              <form action={removeMemberAction}><input type="hidden" name="user_id" value={m.user_id} />
                <ConfirmButton className="pp-btn pp-btn-sm pp-btn-danger" message={`Remove ${m.name || m.email}? Their login will be deleted.`}>Remove</ConfirmButton></form>
            </div>
            <MemberForm member={m} branches={branches} />
          </div>
        ))}
      </div>
      <div className="pp-card" style={{ maxWidth: 640 }}>
        <p className="pp-h2">Add branch staff</p>
        <AddMemberForm branches={branches} />
      </div>
    </div>
  )
}
