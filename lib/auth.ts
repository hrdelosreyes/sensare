import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabaseAuth } from './supabase-server'
import { supabaseAdmin } from './supabase'
import type { Partner } from './partner'

export type Admin = { user_id: string; email: string; name: string | null }

// Verified user from the Supabase Auth server (not just the cookie contents).
export const getUser = cache(async (): Promise<User | null> => {
  const sb = await supabaseAuth()
  const { data, error } = await sb.auth.getUser()
  if (error) return null
  return data.user
})

export const getAdmin = cache(async (): Promise<Admin | null> => {
  const user = await getUser()
  if (!user) return null
  const { data } = await supabaseAdmin()
    .from('sensare_admins').select('user_id, email, name').eq('user_id', user.id).maybeSingle()
  return (data as Admin) ?? null
})

export const getPartner = cache(async (): Promise<Partner | null> => {
  const user = await getUser()
  if (!user) return null
  const { data } = await supabaseAdmin()
    .from('sensare_partners').select('*').eq('user_id', user.id).maybeSingle()
  return (data as Partner) ?? null
})

// ---- Page guards (redirect) ------------------------------------------------

export async function requireAdminPage(): Promise<Admin> {
  const admin = await getAdmin()
  if (!admin) redirect('/admin/login')
  return admin
}

export async function requireApprovedPartnerPage(): Promise<Partner> {
  const partner = await getPartner()
  if (!partner) redirect('/partners/login')
  if (partner.status !== 'approved') redirect('/partners/status')
  return partner
}

// ---- Action / route guards (throw) -----------------------------------------

export class AuthError extends Error {}

export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin()
  if (!admin) throw new AuthError('Not authorized')
  return admin
}

export async function requireApprovedPartner(): Promise<Partner> {
  const partner = await getPartner()
  if (!partner || partner.status !== 'approved') throw new AuthError('Not authorized')
  return partner
}
