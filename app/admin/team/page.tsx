import { requireAdminPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { fmtDate } from '@/lib/partner'
import { ConfirmButton } from '@/components/portal/forms'
import { removeAdminAction } from '../actions'
import { AddAdminForm, ChangePasswordForm } from './forms'

export default async function TeamPage() {
  const me = await requireAdminPage()
  const { data: admins } = await supabaseAdmin().from('sensare_admins').select('*').order('created_at')
  const list = admins ?? []
  return (
    <div className="pp-stack">
      <h1 className="pp-h1">Team</h1>
      <div className="pp-card">
        <p className="pp-h2">Admins</p>
        <table className="pp-table">
          <thead><tr><th>Name</th><th>Email</th><th>Added</th><th></th></tr></thead>
          <tbody>
            {list.map(a => (
              <tr key={a.user_id}>
                <td>{a.name || '—'}{a.user_id === me.user_id && <span className="pp-badge" style={{ marginLeft: 8 }}>you</span>}</td>
                <td>{a.email}</td>
                <td>{fmtDate(a.created_at)}</td>
                <td>{a.user_id !== me.user_id && list.length > 1 && (
                  <form action={removeAdminAction}><input type="hidden" name="user_id" value={a.user_id} />
                    <ConfirmButton className="pp-btn pp-btn-sm pp-btn-danger" message={`Remove admin access for ${a.email}?`}>Remove</ConfirmButton></form>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pp-hint" style={{ marginTop: 10 }}>All admins can approve partners, manage orders and payments, and add or remove other admins. Admins receive email alerts for new applications, orders and bank transfers.</p>
      </div>
      <div className="pp-grid-2">
        <div className="pp-card"><p className="pp-h2">Add an admin</p><AddAdminForm /></div>
        <div className="pp-card"><p className="pp-h2">Change your password</p><ChangePasswordForm /></div>
      </div>
    </div>
  )
}
