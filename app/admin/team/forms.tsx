'use client'
import { useActionState, useState } from 'react'
import { addAdminAction, changeOwnPasswordAction, updateStaffAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'
import { ROLE_ORDER, ROLES, type StaffRole } from '@/lib/roles'
import type { StaffRow } from './page'

function RoleFields({ role, onRole, commission }: { role: StaffRole; onRole: (r: StaffRole) => void; commission?: number | null }) {
  return (
    <>
      <label className="pp-field"><span className="pp-label">Role</span>
        <select className="pp-select" name="role" value={role} onChange={e => onRole(e.target.value as StaffRole)}>
          {ROLE_ORDER.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
        </select>
        <span className="pp-hint">{ROLES[role].description}</span></label>
      {role === 'account_manager' && (
        <label className="pp-field"><span className="pp-label">Commission (% of confirmed collections)</span>
          <input className="pp-input" name="commission_pct" type="number" min={0} max={100} step="0.01" defaultValue={commission ?? ''} placeholder="e.g. 5" style={{ maxWidth: 140 }} /></label>
      )}
    </>
  )
}

export function AddAdminForm() {
  const [state, action] = useActionState(addAdminAction, undefined)
  const [role, setRole] = useState<StaffRole>('manager')
  return (
    <ActionForm action={action}>
      <FormMessage state={state} />
      <div className="pp-grid-2" style={{ gap: '0 16px' }}>
        <label className="pp-field"><span className="pp-label">Name</span><input className="pp-input" name="name" maxLength={100} /></label>
        <label className="pp-field"><span className="pp-label">Mobile</span><input className="pp-input" name="phone" maxLength={50} /></label>
      </div>
      <label className="pp-field"><span className="pp-label">Email</span><input className="pp-input" name="email" type="email" required /></label>
      <RoleFields role={role} onRole={setRole} />
      <label className="pp-field"><span className="pp-label">Temporary password</span>
        <input className="pp-input" name="password" type="text" minLength={10} autoComplete="off" />
        <span className="pp-hint">Required for new accounts (10+ characters). Leave blank if this person already has an account.</span></label>
      <SubmitButton>Add team member</SubmitButton>
    </ActionForm>
  )
}

export function StaffRowForm({ staff, isMe }: { staff: StaffRow; isMe: boolean }) {
  const [state, action] = useActionState(updateStaffAction, undefined)
  const [role, setRole] = useState<StaffRole>(staff.role)
  return (
    <ActionForm action={action}>
      <input type="hidden" name="user_id" value={staff.user_id} />
      <input type="hidden" name="phone" value={staff.phone ?? ''} />
      <FormMessage state={state} />
      <div className="pp-row" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 260px' }}><RoleFields role={role} onRole={setRole} commission={staff.commission_pct} /></div>
        <label className="pp-row pp-muted" style={{ gap: 6, marginBottom: 16 }}>
          <input type="checkbox" name="is_active" defaultChecked={staff.is_active} disabled={isMe} /> Active
          {isMe && <input type="hidden" name="is_active" value="on" />}
        </label>
        <div style={{ marginBottom: 16 }}><SubmitButton className="pp-btn pp-btn-sm">Save</SubmitButton></div>
      </div>
    </ActionForm>
  )
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changeOwnPasswordAction, undefined)
  return (
    <ActionForm action={action}>
      <FormMessage state={state} />
      <label className="pp-field"><span className="pp-label">Current password</span><input className="pp-input" name="current" type="password" required autoComplete="current-password" /></label>
      <label className="pp-field"><span className="pp-label">New password</span><input className="pp-input" name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
      <label className="pp-field"><span className="pp-label">Confirm</span><input className="pp-input" name="confirm" type="password" required minLength={10} autoComplete="new-password" /></label>
      <SubmitButton>Update password</SubmitButton>
    </ActionForm>
  )
}
