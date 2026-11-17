'use server'

import { redirect } from 'next/navigation'
import { db, one } from '@/lib/db'
import {
  checkPasswordReset, completePasswordReset, createPasswordReset, createUser, endSession, findUserByEmail,
  getAdmin, getPartner, getUser, isEmail, normalizeEmail, setPassword, signIn, startSession, verifyPassword,
} from '@/lib/auth'
import { email } from '@/lib/email'
import { BUSINESS_TYPES } from '@/lib/partner'

export type FormState = { error?: string; ok?: string } | undefined

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max)

export async function applyAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (str(fd, 'website')) return { ok: 'Thank you!' } // honeypot

  const business_name = str(fd, 'business_name', 200)
  const contact_name = str(fd, 'contact_name', 200)
  const phone = str(fd, 'phone', 50)
  const business_type = str(fd, 'business_type', 50)
  const city = str(fd, 'city', 100)
  const province = str(fd, 'province', 100)
  const expected = Number(fd.get('expected_monthly_cases') || 0)

  if (!business_name || !contact_name || !phone || !city) {
    return { error: 'Please fill in all required fields.' }
  }
  if (business_type && !(business_type in BUSINESS_TYPES)) return { error: 'Please choose a business type.' }
  if (fd.get('agree') !== 'on') return { error: 'Please agree to the partner terms.' }

  let user = await getUser()
  if (!user) {
    const emailAddr = normalizeEmail(str(fd, 'email', 200))
    const password = String(fd.get('password') ?? '')
    if (!isEmail(emailAddr)) return { error: 'Please enter a valid email address.' }
    if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

    user = await createUser(emailAddr, password)
    if (user) {
      await startSession(user.id)
    } else {
      // The email already has an account: continue only with its correct password.
      const res = await signIn(emailAddr, password)
      if (!res.user) return { error: 'An account with this email already exists. Enter its correct password, or reset it from the login page.' }
      user = res.user
    }
  }

  if (await getPartner()) redirect('/partners/status')

  const row = {
    user_id: user.id,
    business_name, contact_name, phone,
    email: user.email,
    tin: str(fd, 'tin', 50) || null,
    business_type: business_type || null,
    address: str(fd, 'address', 300) || null,
    city,
    province: province || null,
    sales_channels: str(fd, 'sales_channels', 500) || null,
    expected_monthly_cases: Number.isFinite(expected) && expected > 0 ? Math.round(expected) : null,
    message: str(fd, 'message', 2000) || null,
  }
  try {
    // A "Main" branch is created from this address by a database trigger.
    await db()`insert into sensare_partners ${db()(row)} on conflict (user_id) do nothing`
  } catch (e) {
    console.error('Partner insert failed:', e)
    return { error: 'We could not submit your application. Please try again.' }
  }

  await email.applicationReceived(row)
  redirect('/partners/status')
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = await signIn(str(fd, 'email', 200), String(fd.get('password') ?? ''))
  if (res.error) return { error: res.error }

  const partner = await getPartner()
  if (!partner) redirect((await getAdmin()) ? '/admin' : '/partners/apply')
  if (partner.status !== 'approved') redirect('/partners/status')
  redirect('/partners/portal')
}

export async function logoutAction() {
  await endSession()
  redirect('/partners/login')
}

export async function forgotPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const emailAddr = normalizeEmail(str(fd, 'email', 200))
  if (!isEmail(emailAddr)) return { error: 'Please enter your email.' }
  // Throttle: at most 3 reset emails per account per hour.
  const recent = await one(db()<{ n: number }[]>`
    select count(*)::int as n from sensare_password_resets r join sensare_users u on u.id = r.user_id
    where lower(u.email) = ${emailAddr} and r.created_at > now() - interval '1 hour'`)
  if ((recent?.n ?? 0) < 3) {
    const token = await createPasswordReset(emailAddr)
    if (token) await email.passwordReset(emailAddr, token)
  }
  // Same response whether or not the account exists.
  return { ok: 'If an account exists for that email, a reset link is on its way. It expires in 1 hour.' }
}

/** Password reset from an emailed link. */
export async function resetPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get('token') ?? '')
  const password = String(fd.get('password') ?? '')
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'Passwords do not match.' }
  if (!(await checkPasswordReset(token))) return { error: 'This link is invalid or has expired. Please request a new one.' }
  const userId = await completePasswordReset(token, password)
  if (!userId) return { error: 'This link is invalid or has expired. Please request a new one.' }
  // Signed in now: go straight to the right place (the link itself is used up).
  const isAdmin = await one(db()`select 1 from sensare_admins where user_id = ${userId}`)
  redirect(isAdmin ? '/admin' : '/partners/portal?reset=1')
}

/** Password change while signed in (needs the current password). */
export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser()
  if (!user) return { error: 'Your session has expired. Please log in again.' }
  const password = String(fd.get('password') ?? '')
  if (password.length < 8) return { error: 'New password must be at least 8 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'Passwords do not match.' }
  const account = await findUserByEmail(user.email)
  if (!account || !(await verifyPassword(String(fd.get('current') ?? ''), account.password_hash))) {
    return { error: 'Your current password is incorrect.' }
  }
  await setPassword(user.id, password)
  return { ok: 'Password updated. Other devices have been signed out.' }
}
