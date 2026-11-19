// Browser-side Meta Pixel helpers. Safe to import from client components.
// Nothing is sent unless a Pixel ID is configured AND the shopper accepted advertising cookies.

export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || ''
export const CONSENT_COOKIE = 'sensare_ads_consent'
export const CONSENT_EVENT = 'sensare:consent'
export const CONSENT_OPEN_EVENT = 'sensare:consent-open'

type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown }
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }

export type Consent = 'granted' | 'denied' | null

export function getConsent(): Consent {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=(granted|denied)`))
  return (m?.[1] as Consent) ?? null
}

export function setConsent(value: 'granted' | 'denied') {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`
  if (value === 'denied') {
    window.fbq?.('consent', 'revoke')
    // Remove Meta's own cookies so nothing lingers after opting out.
    const host = location.hostname.replace(/^www\./, '')
    for (const c of ['_fbp', '_fbc']) {
      for (const domain of ['', `; Domain=.${host}`, `; Domain=${host}`]) document.cookie = `${c}=; Path=/; Max-Age=0${domain}`
    }
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
}

/** Pages that never load the Pixel: staff admin and the logged-in Partner Portal. */
export function isTrackedPath(pathname: string) {
  if (pathname.startsWith('/admin')) return false
  if (pathname.startsWith('/partners/') && pathname !== '/partners/apply') return false
  return true
}

export function canTrack() {
  return Boolean(PIXEL_ID) && getConsent() === 'granted' && typeof window !== 'undefined' && isTrackedPath(location.pathname)
}

/** Fire a standard event. `eventId` must match the server (CAPI) event so Meta counts it once. */
export function track(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (!canTrack() || !window.fbq) return
  if (eventId) window.fbq('track', event, params ?? {}, { eventID: eventId })
  else window.fbq('track', event, params ?? {})
}

/** Meta's standard base code, loaded only after consent. */
export function loadPixel() {
  if (!PIXEL_ID || window.fbq) return
  const n: Fbq = function (...args: unknown[]) {
    if (n.callMethod) (n.callMethod as (...a: unknown[]) => void)(...args)
    else n.queue!.push(args)
  } as Fbq
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []
  window.fbq = n; window._fbq = n
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(s)
  n('consent', 'grant')
  n('init', PIXEL_ID)
}
