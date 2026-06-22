'use client'
import { useState } from 'react'

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus(res.ok ? 'ok' : 'error')
    } catch { setStatus('error') }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '64px 24px' }}>
      {status === 'ok' ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontFamily: 'Allura', fontSize: 40, color: 'var(--rose-gold)', marginBottom: 12 }}>♥</p>
          <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 18, color: 'var(--cream-dim)' }}>Thank you. We'll get back to you within 24 hours.</p>
        </div>
      ) : (
        <form onSubmit={submit}>
          {[
            { label: 'Your Name', key: 'name', type: 'text' },
            { label: 'Email Address', key: 'email', type: 'email' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{f.label}</label>
              <input
                type={f.type} required value={(form as Record<string, string>)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '14px 18px', background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.25)', color: 'var(--cream)', fontFamily: 'PlayfairDisplay', fontSize: 15, outline: 'none', borderRadius: 2 }}
              />
            </div>
          ))}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Message</label>
            <textarea required rows={6} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              style={{ width: '100%', padding: '14px 18px', background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.25)', color: 'var(--cream)', fontFamily: 'PlayfairDisplay', fontSize: 15, outline: 'none', borderRadius: 2, resize: 'vertical' }}
            />
          </div>
          <button type="submit" disabled={status === 'loading'} style={{ width: '100%', padding: '16px', background: 'var(--rose-gold)', border: 'none', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2 }}>
            {status === 'loading' ? 'Sending…' : 'Send Message'}
          </button>
          {status === 'error' && <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: '#e07070', marginTop: 12 }}>Something went wrong. Email us directly at hello@mysensare.com</p>}
        </form>
      )}

      <div style={{ marginTop: 56, paddingTop: 32, borderTop: '1px solid rgba(201,144,106,0.1)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Prefer email?</p>
        <a href="mailto:hello@mysensare.com" style={{ fontFamily: 'PlayfairDisplay', fontSize: 16, color: 'var(--rose-gold)' }}>hello@mysensare.com</a>
      </div>
    </div>
  )
}
