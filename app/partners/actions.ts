'use server'

import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabase-server'
import { getUser, getPartner } from '@/lib/auth'
import { email } from '@/lib/email'
import { BUSINESS_TYPES } from '@/lib/partner'
import { SITE_URL } from '@/lib/seo'

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
    const emailAddr = str(fd, 'email', 200).toLowerCase()
    const password = String(fd.get('password') ?? '')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr)) return { error: 'Please enter a valid email address.' }
    if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

    const admin = supabaseAdmin()
    const { error: createErr } = await admin.auth.admin.createUser({
      email: emailAddr, password, email_confirm: true,
      user_metadata: { full_name: contact_name, source: 'sensare_partner_signup' },
    })
    const exists = createErr && (createErr.code === 'email_exists' || /already/i.test(createErr.message))
    if (createErr && !exists) {
      console.error('Partner signup createUser failed:', createErr)
      return { error: 'We could not create your account. Please try again.' }
    }

    const sb = await supabaseAuth()
    const { data, error: signInErr } = await sb.auth.signInWithPassword({ email: emailAddr, password })
    if (signInErr || !data.user) {
      return exists
        ? { error: 'An account with this email already exists. Enter its correct password, or reset it from the login page.' }
        : { error: 'Account created, but we could not sign you in. Please log in.' }
    }
    user = data.user
  }

  const existing = await getPartner()
  if (existing) redirect('/partners/status')

  const row = {
    user_id: user.id,
    business_name, contact_name, phone,
    email: user.email!,
    tin: str(fd, 'tin', 50) || null,
    business_type: business_type || null,
    address: str(fd, 'address', 300) || null,
    city, province: province || null,
    sales_channels: str(fd, 'sales_channels', 500) || null,
    expected_monthly_cases: Number.isFinite(expected) && expected > 0 ? Math.round(expected) : null,
    message: str(fd, 'message', 2000) || null,
  }
  const { error } = await supabaseAdmin().from('sensare_partners').insert(row)
  if (error) {
    console.error('Partner insert failed:', error)
    return { error: 'We could not submit your application. Please try again.' }
  }

  await email.applicationReceived(row)
  redirect('/partners/status')
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const emailAddr = str(fd, 'email', 200).toLowerCase()
  const password = String(fd.get('password') ?? '')
  const sb = await supabaseAuth()
  const { error } = await sb.auth.signInWithPassword({ email: emailAddr, password })
  if (error) return { error: 'Incorrect email or password.' }

  const partner = await getPartner()
  if (!partner) redirect('/partners/apply')
  if (partner.status !== 'approved') redirect('/partners/status')
  redirect('/partners/portal')
}

export async function logoutAction() {
  const sb = await supabaseAuth()
  await sb.auth.signOut()
  redirect('/partners/login')
}

export async function forgotPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const emailAddr = str(fd, 'email', 200).toLowerCase()
  if (!emailAddr) return { error: 'Please enter your email.' }
  const sb = await supabaseAuth()
  await sb.auth.resetPasswordForEmail(emailAddr, {
    redirectTo: `${SITE_URL}/partners/auth/callback?next=/partners/reset-password`,
  })
  // Same response whether or not the account exists.
  return { ok: 'If an account exists for that email, a reset link is on its way.' }
}

export async function updatePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get('password') ?? '')
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== String(fd.get('confirm') ?? '')) return { error: 'Passwords do not match.' }
  const user = await getUser()
  if (!user) return { error: 'Your session has expired. Please log in again.' }
  const sb = await supabaseAuth()
  const { error } = await sb.auth.updateUser({ password })
  if (error) return { error: error.message }
  return { ok: 'Password updated.' }
}
