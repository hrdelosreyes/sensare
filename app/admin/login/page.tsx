'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { router.push('/admin') } else { setError('Incorrect password.'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--espresso)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <Image src="/logo-sensare.png" alt="Sensarè" width={64} height={64} style={{ objectFit: 'contain', marginBottom: 16 }} />
        <p style={{ fontFamily: 'OleoScript', fontSize: 24, color: 'var(--rose-gold)', marginBottom: 4 }}>Sensarè</p>
        <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 36 }}>Admin</p>

        <form onSubmit={login}>
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            style={{ width: '100%', padding: '14px 18px', marginBottom: 16, background: 'var(--chocolate)', border: '1px solid rgba(201,144,106,0.25)', color: 'var(--cream)', fontFamily: 'PlayfairDisplay', fontSize: 15, outline: 'none', borderRadius: 2 }}
          />
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: 'var(--rose-gold)', border: 'none', color: 'var(--espresso)', fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2 }}>
            {loading ? '...' : 'Enter'}
          </button>
          {error && <p style={{ fontFamily: 'PlayfairDisplay', fontSize: 13, color: '#e07070', marginTop: 12 }}>{error}</p>}
        </form>
      </div>
    </div>
  )
}
