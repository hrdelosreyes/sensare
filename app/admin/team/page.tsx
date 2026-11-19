import { Fragment } from 'react'
import { requireAdminPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtDate } from '@/lib/partner'
import { ROLE_ORDER, ROLES, type StaffRole } from '@/lib/roles'
import { ConfirmButton } from '@/components/portal/forms'
import { removeAdminAction } from '../actions'
import { AddAdminForm, StaffRowForm } from './forms'

export type StaffRow = {
  user_id: string; email: string; name: string | null; role: StaffRole; commission_pct: number | null
  referral_code: string | null; phone: string | null; is_active: boolean; created_at: string; accounts: number
}

export default async function TeamPage() {
  const me = await requireAdminPage('team.manage')
  const list = await db()<StaffRow[]>`
    select a.*, (select count(*) from sensare_partners p where p.account_manager_id = a.user_id)::int as accounts
    from sensare_admins a order by a.is_active desc, a.created_at`
  return (
    <div className="pp-stack">
      <h1 className="pp-h1">Team</h1>
      <div className="pp-card">
        <p className="pp-h2">People & roles</p>
        <div className="pp-stack" style={{ gap: 0 }}>
          {list.map(a => (
            <div key={a.user_id} style={{ borderTop: '1px solid rgba(201,144,106,0.1)', padding: '16px 0' }}>
              <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <strong style={{ color: 'var(--cream)' }}>{a.name || a.email}</strong>
                  {a.user_id === me.user_id && <span className="pp-badge" style={{ marginLeft: 8 }}>you</span>}
                  {!a.is_active && <span className="pp-badge pp-badge-mute" style={{ marginLeft: 8 }}>inactive</span>}
                  <br /><span className="pp-muted" style={{ fontSize: 13 }}>{a.email}{a.phone ? ` · ${a.phone}` : ''} · added {fmtDate(a.created_at)}
                    {a.role === 'account_manager' && ` · ${a.accounts} account${a.accounts === 1 ? '' : 's'}${a.referral_code ? ` · code ${a.referral_code}` : ''}`}</span>
                </div>
                {a.user_id !== me.user_id && (
                  <form action={removeAdminAction}><input type="hidden" name="user_id" value={a.user_id} />
                    <ConfirmButton className="pp-btn pp-btn-sm pp-btn-danger" message={`Remove ${a.email} from the team?${a.accounts ? ' Their accounts will be unassigned.' : ''}`}>Remove</ConfirmButton></form>
                )}
              </div>
              <StaffRowForm staff={a} isMe={a.user_id === me.user_id} />
            </div>
          ))}
        </div>
      </div>
      <div className="pp-grid-2">
        <div className="pp-card"><p className="pp-h2">Add a team member</p><AddAdminForm /></div>
        <div className="pp-card">
          <p className="pp-h2">What each role can do</p>
          <dl className="pp-dl">
            {ROLE_ORDER.map(r => <Fragment key={r}><dt>{ROLES[r].label}</dt><dd>{ROLES[r].description}</dd></Fragment>)}
          </dl>
          <p className="pp-hint" style={{ marginTop: 12 }}>Change your own password under My Account.</p>
        </div>
      </div>
    </div>
  )
}
