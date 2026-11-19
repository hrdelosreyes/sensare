// Database migrations for Neon / Postgres. Runs before `next build` (see package.json).
//
//  1. Applies db/migrations/*.sql in order, once each (tracked in sensare_schema_migrations).
//  2. If SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are set,
//     copies the storefront data from the old Supabase project (idempotent; safe every deploy).
//  3. Seeds the starter catalogue into an empty database when there was nothing to import.
//
// Without a database URL (e.g. a local build) it does nothing.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!url) {
  console.log('[migrate] No DATABASE_URL — skipping database migrations.')
  process.exit(0)
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: false, connect_timeout: 30 })
const log = (...a) => console.log('[migrate]', ...a)

// Storefront tables copied from Supabase, parents first.
const IMPORT_TABLES = [
  'sensare_products',
  'sensare_product_images',
  'sensare_testimonials',
  'sensare_newsletter_subscribers',
  'sensare_restock_notifications',
  'sensare_orders',
]

async function migrate() {
  await sql`create table if not exists sensare_schema_migrations (name text primary key, applied_at timestamptz not null default now())`
  const done = new Set((await sql`select name from sensare_schema_migrations`).map(r => r.name))
  const files = readdirSync(join(root, 'db/migrations')).filter(f => f.endsWith('.sql')).sort()
  for (const f of files) {
    if (done.has(f)) continue
    log('applying', f)
    await sql.begin(async tx => {
      await tx.unsafe(readFileSync(join(root, 'db/migrations', f), 'utf8'))
      await tx`insert into sensare_schema_migrations (name) values (${f})`
    })
  }
}

async function fetchAll(base, key, table) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${base}/rest/v1/${table}?select=*&order=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    })
    if (res.status === 404) return null // table doesn't exist there
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

async function importFromSupabase() {
  const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return false
  log('importing storefront data from Supabase…')
  for (const table of IMPORT_TABLES) {
    const rows = await fetchAll(base, key, table)
    if (!rows) { log(`  ${table}: not found in Supabase, skipped`); continue }
    if (!rows.length) { log(`  ${table}: 0 rows`); continue }
    const cols = (await sql`select column_name from information_schema.columns where table_schema = current_schema() and table_name = ${table}`)
      .map(r => r.column_name)
    const shared = cols.filter(c => c in rows[0])
    let added = 0
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200).map(r => Object.fromEntries(shared.map(c => [c, r[c]])))
      const res = table === 'sensare_products'
        // Products keep Supabase's ids so order history and links still match. Existing
        // products are never overwritten: Neon is now the source of truth for names,
        // prices and stock (edits made here must survive later deploys).
        ? await sql`insert into ${sql(table)} ${sql(batch, shared)}
            on conflict do nothing
            returning true as inserted`
        : await sql`insert into ${sql(table)} ${sql(batch, shared)} on conflict do nothing returning 1`
      added += table === 'sensare_products' ? res.filter(r => r.inserted).length : res.count
    }
    log(`  ${table}: ${rows.length} rows in Supabase, ${added} new`)
  }
  return true
}

async function seedIfEmpty() {
  const [{ n }] = await sql`select count(*)::int as n from sensare_products`
  if (n > 0) return
  log('empty catalogue — loading starter products and testimonials')
  await sql.unsafe(readFileSync(join(root, 'db/seed.sql'), 'utf8'))
}

try {
  await sql`select pg_advisory_lock(727274)` // one deploy migrates at a time
  await migrate()
  await importFromSupabase()
  await seedIfEmpty()
  log('database ready')
} catch (e) {
  console.error('[migrate] failed:', e)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
