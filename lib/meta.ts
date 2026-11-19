import 'server-only'
import { createHash } from 'crypto'

// Meta Conversions API (CAPI): sends ad-measurement events from our server, so sales are
// still counted when a browser or ad-blocker stops the Pixel. Each event carries the same
// event_id the Pixel uses, so Meta counts it once.
//
// Only sent for shoppers who accepted advertising cookies (see components/MetaPixel.tsx).
// Needs NEXT_PUBLIC_META_PIXEL_ID + META_ACCESS_TOKEN; does nothing without them.
// META_TEST_EVENT_CODE (optional) routes events to Events Manager → Test Events.

export const AD_CONSENT_COOKIE = 'sensare_ads_consent'
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0'

/** What we keep from the shopper's browser at checkout to match the later server event. */
export type AdContext = { fbp?: string; fbc?: string; ip?: string; ua?: string; url?: string }

type Cookies = { get(name: string): { value: string } | undefined }

/** Returns the browser details to store with an order, or null when the shopper hasn't opted in. */
export function adContextFrom(cookies: Cookies, headers: Headers): AdContext | null {
  if (!metaEnabled() || cookies.get(AD_CONSENT_COOKIE)?.value !== 'granted') return null
  const ctx: AdContext = {
    fbp: cookies.get('_fbp')?.value?.slice(0, 200),
    fbc: cookies.get('_fbc')?.value?.slice(0, 500),
    ip: headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || undefined,
    ua: headers.get('user-agent')?.slice(0, 400) || undefined,
    url: headers.get('referer')?.slice(0, 500) || undefined,
  }
  return Object.fromEntries(Object.entries(ctx).filter(([, v]) => v)) as AdContext
}

export function metaEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID && process.env.META_ACCESS_TOKEN)
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
const clean = (v: string) => v.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

/** Philippine mobile → E.164 digits without "+", e.g. 0917 123 4567 → 639171234567. */
export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('0')) return `63${d.slice(1)}`
  if (d.length === 10 && d.startsWith('9')) return `63${d}`
  return d
}

export type Shopper = { email?: string | null; phone?: string | null; name?: string | null; city?: string | null; province?: string | null }

/** Meta's user_data: personal details are normalised then SHA-256 hashed, as Meta requires. */
export function userData(s: Shopper, ctx: AdContext) {
  const ud: Record<string, string | string[]> = { country: [sha256('ph')] }
  const email = s.email?.trim().toLowerCase()
  if (email) { ud.em = [sha256(email)]; ud.external_id = [sha256(email)] }
  const phone = s.phone ? normalizePhone(s.phone) : ''
  if (phone.length >= 10) ud.ph = [sha256(phone)]
  const parts = (s.name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length) ud.fn = [sha256(clean(parts[0]))]
  if (parts.length > 1) ud.ln = [sha256(clean(parts[parts.length - 1]))]
  if (s.city && clean(s.city)) ud.ct = [sha256(clean(s.city))]
  if (s.province && clean(s.province)) ud.st = [sha256(clean(s.province))]
  if (ctx.fbp) ud.fbp = ctx.fbp
  if (ctx.fbc) ud.fbc = ctx.fbc
  if (ctx.ip) ud.client_ip_address = ctx.ip
  if (ctx.ua) ud.client_user_agent = ctx.ua
  return ud
}

export type MetaEvent = {
  name: 'InitiateCheckout' | 'Purchase'
  eventId: string
  sourceUrl: string
  shopper: Shopper
  ctx: AdContext
  custom: Record<string, unknown>
}

/** Sends one event. Never throws: ad measurement must not break checkout or payment. */
export async function sendMetaEvent(e: MetaEvent): Promise<boolean> {
  if (!metaEnabled()) return false
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const body: Record<string, unknown> = {
    data: [{
      event_name: e.name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: e.eventId,
      action_source: 'website',
      event_source_url: e.sourceUrl,
      user_data: userData(e.shopper, e.ctx),
      custom_data: e.custom,
    }],
  }
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixel}/events?access_token=${encodeURIComponent(process.env.META_ACCESS_TOKEN!)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) { console.error(`Meta CAPI ${e.name} ${res.status}:`, (await res.text()).slice(0, 500)); return false }
    return true
  } catch (err) {
    console.error(`Meta CAPI ${e.name} failed:`, err)
    return false
  }
}

type Item = { product_id: string; product_name?: string; qty: number; unit_price?: number }

/** The product part of a Pixel/CAPI event (same shape on both sides). */
export function orderCustomData(items: Item[], value: number) {
  return {
    currency: 'PHP',
    value: Number(value),
    content_type: 'product',
    content_ids: items.map(i => i.product_id),
    contents: items.map(i => ({ id: i.product_id, quantity: i.qty, item_price: Number(i.unit_price ?? 0) })),
    num_items: items.reduce((n, i) => n + i.qty, 0),
  }
}
