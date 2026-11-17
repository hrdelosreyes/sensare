import 'server-only'
import postgres from 'postgres'

// One pool per server instance (reused across requests and hot reloads).
// Neon on Vercel: DATABASE_URL is the pooled connection string set by the
// Vercel ↔ Neon integration; prepare:false keeps it compatible with the pooler.
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL

// Return values in the shapes the app works with: numbers for numeric/int8,
// 'YYYY-MM-DD' strings for dates and ISO strings for timestamps.
const asNumber = (x: string) => Number(x)
const asIso = (x: string) => new Date(x.includes('T') ? x : x.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString()

function create() {
  if (!url) throw new Error('DATABASE_URL is not set')
  return postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: false,
    types: {
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: asNumber },
      int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: asNumber },
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      timestamptz: { to: 1184, from: [1184, 1114], serialize: (x: string) => x, parse: asIso },
    },
  })
}

type Sql = ReturnType<typeof create>
const g = globalThis as unknown as { __sensareSql?: Sql }

export function db(): Sql {
  if (!g.__sensareSql) g.__sensareSql = create()
  return g.__sensareSql
}

/** First row or null. */
export async function one<T>(q: Promise<T[]>): Promise<T | null> {
  const rows = await q
  return rows[0] ?? null
}

/** Message of a database error raised by our SQL functions (RAISE EXCEPTION). */
export function dbMessage(e: unknown): string {
  return e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
}
