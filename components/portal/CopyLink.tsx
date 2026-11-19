'use client'
import { useState } from 'react'

export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="pp-row" style={{ flexWrap: 'nowrap' }}>
      <input className="pp-input" readOnly value={url} onFocus={e => e.currentTarget.select()} style={{ minWidth: 0 }} aria-label="Sign-up link" />
      <button type="button" className="pp-btn pp-btn-sm" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* select instead */ }
      }}>{copied ? 'Copied' : 'Copy'}</button>
      <a className="pp-btn pp-btn-ghost pp-btn-sm" href={url} target="_blank" rel="noopener">Open</a>
    </div>
  )
}
