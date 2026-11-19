'use client'
import { useActionState } from 'react'
import { addMemberAction, updateMemberAction } from '../actions'
import { ActionForm, FormMessage, SubmitButton } from '@/components/portal/forms'
import type { Member } from './page'

type Branch = { id: string; name: string }

function BranchChecks({ branches, selected }: { branches: Branch[]; selected?: string[] }) {
  return (
    <fieldset className="pp-field" style={{ border: 'none' }}>
      <legend className="pp-label">Branches</legend>
      <div className="pp-row">
        {branches.map(b => (
          <label key={b.id} className="pp-row pp-muted" style={{ gap: 6 }}>
            <input type="checkbox" name="location_id" value={b.id} defaultChecked={selected ? selected.includes(b.id) : branches.length === 1} /> {b.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function AddMemberForm({ branches }: { branches: Branch[] }) {
  const [state, action] = useActionState(addMemberAction, undefined)
  return (
    <ActionForm action={action}>
      <FormMessage state={state} />
      <div className="pp-grid-2" style={{ gap: '0 16px' }}>
        <label className="pp-field"><span className="pp-label">Name</span><input className="pp-input" name="name" required maxLength={100} /></label>
        <label className="pp-field"><span className="pp-label">Email (their login)</span><input className="pp-input" name="email" type="email" required /></label>
      </div>
      <label className="pp-field"><span className="pp-label">Temporary password</span>
        <input className="pp-input" name="password" type="text" required minLength={8} autoComplete="off" />
        <span className="pp-hint">Share it with them privately; they can change it under Account.</span></label>
      <BranchChecks branches={branches} />
      <SubmitButton>Add staff</SubmitButton>
    </ActionForm>
  )
}

export function MemberForm({ member, branches }: { member: Member; branches: Branch[] }) {
  const [state, action] = useActionState(updateMemberAction, undefined)
  return (
    <ActionForm action={action}>
      <input type="hidden" name="user_id" value={member.user_id} />
      <FormMessage state={state} />
      <BranchChecks branches={branches} selected={member.location_ids} />
      <div className="pp-row">
        <label className="pp-row pp-muted" style={{ gap: 6 }}><input type="checkbox" name="is_active" defaultChecked={member.is_active} /> Active</label>
        <SubmitButton className="pp-btn pp-btn-sm">Save</SubmitButton>
      </div>
    </ActionForm>
  )
}
