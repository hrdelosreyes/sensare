'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PIXEL_ID, CONSENT_EVENT, CONSENT_OPEN_EVENT, getConsent, setConsent, isTrackedPath, loadPixel, track } from '@/lib/pixel'

function subscribe(cb: () => void) {
  window.addEventListener(CONSENT_EVENT, cb)
  return () => window.removeEventListener(CONSENT_EVENT, cb)
}

// Loads the Meta Pixel (after the shopper says yes) and sends a PageView on every page.
// Also shows the cookie choice banner. Renders nothing when no Pixel ID is configured.
export default function MetaPixel() {
  const pathname = usePathname()
  const tracked = isTrackedPath(pathname)
  // 'unknown' while rendering on the server, so the banner only appears in the browser.
  const consent = useSyncExternalStore(subscribe, getConsent, () => 'unknown' as const)
  const granted = consent === 'granted'
  const [reopened, setReopened] = useState(false)
  const showBanner = consent === null || reopened
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    const onOpen = () => setReopened(true)
    const onChange = () => setReopened(false)
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen)
    window.addEventListener(CONSENT_EVENT, onChange)
    return () => { window.removeEventListener(CONSENT_OPEN_EVENT, onOpen); window.removeEventListener(CONSENT_EVENT, onChange) }
  }, [])

  useEffect(() => {
    if (!PIXEL_ID || !granted || !tracked) return
    loadPixel()
    if (lastPath.current !== pathname) { lastPath.current = pathname; track('PageView') }
  }, [granted, tracked, pathname])

  if (!PIXEL_ID || !showBanner || !tracked) return null

  const btn: React.CSSProperties = {
    padding: '11px 20px', fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 1.2,
    textTransform: 'uppercase', borderRadius: 2, cursor: 'pointer', flex: '1 1 auto',
  }
  return (
    <div role="dialog" aria-label="Cookie choices" style={{
      position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 1000, maxWidth: 560, margin: '0 auto',
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6,
      boxShadow: '0 10px 30px rgba(60,20,20,0.18)', padding: '18px 20px',
    }}>
      <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--cream)', lineHeight: 1.7, marginBottom: 14 }}>
        May we use cookies, including Meta&apos;s, to see which of our ads bring you here? It&apos;s optional and helps us
        reach more couples. <Link href="/privacy" style={{ color: 'var(--rose-gold)' }}>Privacy Policy</Link>
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setConsent('granted')}
          style={{ ...btn, background: 'var(--rose-gold)', color: 'var(--espresso)', border: 'none', fontWeight: 700 }}>
          Accept
        </button>
        <button type="button" onClick={() => setConsent('denied')}
          style={{ ...btn, background: 'none', color: 'var(--cream-dim)', border: '1px solid rgba(164,82,63,0.35)' }}>
          No thanks
        </button>
      </div>
    </div>
  )
}

/** Fires one Pixel event when the page mounts (e.g. ViewContent, Purchase). */
export function PixelEvent({ event, params, eventId, once }: { event: string; params?: Record<string, unknown>; eventId?: string; once?: string }) {
  useEffect(() => {
    const fire = () => {
      if (once) {
        try { if (sessionStorage.getItem(`px_${once}`)) return; } catch {}
      }
      loadPixel()
      track(event, params, eventId)
      if (once) { try { sessionStorage.setItem(`px_${once}`, '1') } catch {} }
    }
    if (getConsent() === 'granted') fire()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
