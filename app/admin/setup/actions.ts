'use server'

import { redirect } from 'next/navigation'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { createUser, findUserByEmail, hasAnyAdmin, isEmail, normalizeEmail, startSession, verifyPassword } from '@/lib/auth'

export type FormState = { error?: string } | undefined

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

// One-time creation of the first admin. Only works while no admin exists, and
// only with the setup code: the site's existing ADMIN_PASSWORD (or ADMIN_SETUP_CODE).
export async function setupFirstAdminAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (await hasAnyAdmin()) redirect('/admin/login')
  const code = process.env.ADMIN_SETUP_CODE || process.env.ADMIN_PASSWORD
  if (!code) return { error: 'Set ADMIN_SETUP_CODE (or keep ADMIN_PASSWORD) in Vercel, redeploy, then try again.' }
  if (!same(String(fd.get('code') ?? ''), code)) return { error: 'The setup code is incorrect.' }

  const name = String(fd.get('name') ?? '').trim().slice(0, 100) || null
  const email = normalizeEmail(String(fd.get('email') ?? ''))
  const password = String(fd.get('password') ?? '')
  if (!isEmail(email)) return { error: 'Enter a valid email.' }
  if (password.length < 10) return { error: 'Use a password of at least 10 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'Passwords do not match.' }

  let userId = (await createUser(email, password))?.id
  if (!userId) {
    const existing = await findUserByEmail(email)
    if (!existing || !(await verifyPassword(password, existing.password_hash))) {
      return { error: 'That email already has an account — enter its current password.' }
    }
    userId = existing.id
  }
  // Re-check inside the insert so two simultaneous attempts can't both succeed.
  const rows = await db()`
    insert into sensare_admins (user_id, email, name)
    select ${userId}, ${email}, ${name}
    where not exists (select 1 from sensare_admins)
    returning user_id`
  if (!rows.length) redirect('/admin/login')
  await startSession(userId)
  redirect('/admin')
}
