import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { db, one } from './db'
import type { Partner } from './partner'
import { can, homeFor, type Permission, type StaffRole } from './roles'

// Email + password accounts with server-side sessions (replaces Supabase Auth).
//  - Passwords: scrypt (N=16384, r=8, p=1) with a random salt per user.
//  - Sessions: a random 256-bit token in an httpOnly cookie; only its SHA-256 is stored.
//  - Password guessing: 8 failed attempts per email in 15 minutes locks sign-in briefly.

export type User = { id: string; email: string }
export type Admin = {
  user_id: string; email: string; name: string | null; role: StaffRole
  commission_pct: number | null; referral_code: string | null; phone: string | null
}

export type PartnerAccess = { partner: Partner; role: 'owner' | 'branch_staff'; locationIds: string[] | null }

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>
const COOKIE = 'sns_session'
const SESSION_DAYS = 30
const MAX_FAILURES = 8
const FAILURE_WINDOW_MIN = 15

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const normalizeEmail = (e: string) => e.trim().toLowerCase()
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

// ---- Passwords ----------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt') return false
  const expected = Buffer.from(hash, 'base64')
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

// Used when no account matches, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64')

// ---- Users ----------------------------------------------------------------------

export async function findUserByEmail(email: string) {
  return one(db()<{ id: string; email: string; password_hash: string }[]>`
    select id, email, password_hash from sensare_users where lower(email) = ${normalizeEmail(email)}`)
}

/** Creates an account. Returns null when the email is already registered. */
export async function createUser(email: string, password: string): Promise<User | null> {
  const hash = await hashPassword(password)
  return one(db()<User[]>`
    insert into sensare_users (email, password_hash) values (${normalizeEmail(email)}, ${hash})
    on conflict ((lower(email))) do nothing
    returning id, email`)
}

/** Sets a new password and signs the user out everywhere else. */
export async function setPassword(userId: string, password: string, keepCurrentSession = true) {
  const hash = await hashPassword(password)
  const current = keepCurrentSession ? (await cookies()).get(COOKIE)?.value : undefined
  await db()`update sensare_users set password_hash = ${hash}, password_changed_at = now() where id = ${userId}`
  await db()`delete from sensare_sessions where user_id = ${userId} and token_hash <> ${current ? sha256(current) : ''}`
}

// ---- Sessions -------------------------------------------------------------------

/** Starts a session and sets the cookie. Call from a Server Action or Route Handler. */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const ua = (await headers()).get('user-agent')?.slice(0, 300) ?? null
  await db()`
    insert into sensare_sessions (token_hash, user_id, expires_at, user_agent)
    values (${sha256(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}::int), ${ua})`
  await db()`update sensare_users set last_login_at = now() where id = ${userId}`
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await db()`delete from sensare_sessions where token_hash = ${sha256(token)}`
  jar.delete(COOKIE)
}

/** Verifies email + password (with throttling) and starts a session. */
export async function signIn(email: string, password: string): Promise<{ user?: User; error?: string }> {
  const e = normalizeEmail(email)
  const [{ n }] = await db()<{ n: number }[]>`
    select count(*)::int as n from sensare_login_failures
    where lower(email) = ${e} and created_at > now() - make_interval(mins => ${FAILURE_WINDOW_MIN}::int)`
  if (n >= MAX_FAILURES) return { error: `Too many attempts. Please wait ${FAILURE_WINDOW_MIN} minutes or reset your password.` }

  const user = await findUserByEmail(e)
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH)
  if (!user || !ok) {
    await db()`insert into sensare_login_failures (email) values (${e})`
    return { error: 'Incorrect email or password.' }
  }
  await db()`delete from sensare_login_failures where lower(email) = ${e}`
  await startSession(user.id)
  return { user: { id: user.id, email: user.email } }
}

// Verified user for this request (cached per render).
export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  return one(db()<User[]>`
    select u.id, u.email from sensare_sessions s join sensare_users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`)
})

// ---- Password reset ---------------------------------------------------------------

/** Creates a one-hour reset token for the email, if an account exists. Returns the raw token. */
export async function createPasswordReset(email: string): Promise<string | null> {
  const user = await findUserByEmail(email)
  if (!user) return null
  const token = randomBytes(32).toString('base64url')
  await db()`
    insert into sensare_password_resets (token_hash, user_id, expires_at)
    values (${sha256(token)}, ${user.id}, now() + interval '1 hour')`
  return token
}

export async function checkPasswordReset(token: string): Promise<{ userId: string; email: string } | null> {
  if (!token) return null
  return one(db()<{ userId: string; email: string }[]>`
    select r.user_id as "userId", u.email from sensare_password_resets r join sensare_users u on u.id = r.user_id
    where r.token_hash = ${sha256(token)} and r.used_at is null and r.expires_at > now()`)
}

/** Uses a reset token: sets the password, signs out every session, signs in here. Returns the user id. */
export async function completePasswordReset(token: string, password: string): Promise<string | null> {
  const used = await one(db()<{ user_id: string }[]>`
    update sensare_password_resets set used_at = now()
    where token_hash = ${sha256(token)} and used_at is null and expires_at > now()
    returning user_id`)
  if (!used) return null
  await setPassword(used.user_id, password, false)
  await db()`delete from sensare_login_failures where lower(email) = (select lower(email) from sensare_users where id = ${used.user_id})`
  await startSession(used.user_id)
  return used.user_id
}

// ---- Roles ------------------------------------------------------------------------

export const getAdmin = cache(async (): Promise<Admin | null> => {
  const user = await getUser()
  if (!user) return null
  return one(db()<Admin[]>`
    select user_id, email, name, role, commission_pct, referral_code, phone
    from sensare_admins where user_id = ${user.id} and is_active`)
})

/** The partner this user belongs to: as its owner, or as branch staff (limited to some branches). */
export const getPartnerAccess = cache(async (): Promise<PartnerAccess | null> => {
  const user = await getUser()
  if (!user) return null
  const owned = await one(db()<Partner[]>`select * from sensare_partners where user_id = ${user.id}`)
  if (owned) return { partner: owned, role: 'owner', locationIds: null }
  const member = await one(db()<(Partner & { member_location_ids: string[] })[]>`
    select p.*, coalesce(array(select l.location_id from sensare_partner_member_locations l where l.user_id = m.user_id), '{}') as member_location_ids
    from sensare_partner_members m join sensare_partners p on p.id = m.partner_id
    where m.user_id = ${user.id} and m.is_active`)
  if (!member) return null
  const { member_location_ids, ...partner } = member
  return { partner: partner as Partner, role: 'branch_staff', locationIds: member_location_ids }
})

export const getPartner = cache(async (): Promise<Partner | null> => (await getPartnerAccess())?.partner ?? null)

export async function hasAnyAdmin(): Promise<boolean> {
  const [{ n }] = await db()<{ n: number }[]>`select count(*)::int as n from sensare_admins`
  return n > 0
}

// ---- Page guards (redirect) ---------------------------------------------------------

/** Signed-in, active staff with the permission; otherwise redirect (login, or the role's home). */
export async function requireAdminPage(perm?: Permission): Promise<Admin> {
  const admin = await getAdmin()
  if (!admin) redirect('/admin/login')
  if (perm && !can(admin.role, perm)) redirect(homeFor(admin.role))
  return admin
}

/** Approved partner owner. Branch staff are sent to Daily Sales unless `allowStaff`. */
export async function requireApprovedPartnerPage(opts: { allowStaff?: boolean } = {}): Promise<Partner> {
  return (await requirePartnerAccessPage(opts)).partner
}

export async function requirePartnerAccessPage(opts: { allowStaff?: boolean } = {}): Promise<PartnerAccess> {
  const access = await getPartnerAccess()
  if (!access) redirect('/partners/login')
  if (access.partner.status !== 'approved') redirect('/partners/status')
  if (access.role !== 'owner' && !opts.allowStaff) redirect('/partners/portal/sales')
  return access
}

// ---- Action / route guards (throw) -----------------------------------------------------

export class AuthError extends Error {}

export async function requireAdmin(perm?: Permission): Promise<Admin> {
  const admin = await getAdmin()
  if (!admin || (perm && !can(admin.role, perm))) throw new AuthError('Not authorized')
  return admin
}

/** Approved partner owner (default), or branch staff when `allowStaff`. */
export async function requireApprovedPartner(opts: { allowStaff?: boolean } = {}): Promise<Partner> {
  return (await requirePartnerAccess(opts)).partner
}

export async function requirePartnerAccess(opts: { allowStaff?: boolean } = {}): Promise<PartnerAccess> {
  const access = await getPartnerAccess()
  if (!access || access.partner.status !== 'approved') throw new AuthError('Not authorized')
  if (access.role !== 'owner' && !opts.allowStaff) throw new AuthError('Not authorized')
  return access
}

/** Can this staff member see this partner? (Account managers: only their assigned partners.) */
export async function canAccessPartner(admin: Admin, partnerId: string): Promise<boolean> {
  if (admin.role !== 'account_manager') return true
  return !!(await one(db()`select 1 from sensare_partners where id = ${partnerId} and account_manager_id = ${admin.user_id}`))
}
