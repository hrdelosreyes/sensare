'use client'
import { useActionState } from 'react'
import { applyAction } from '../actions'
import { FormMessage, SubmitButton } from '@/components/portal/forms'
import { BUSINESS_TYPES } from '@/lib/partner'

export default function ApplyForm({ loggedInEmail }: { loggedInEmail: string | null }) {
  const [state, action] = useActionState(applyAction, undefined)

  return (
    <form action={action} className="pp-card">
      <FormMessage state={state} />

      <p className="pp-h3">Your account</p>
      {loggedInEmail ? (
        <p className="pp-muted" style={{ marginBottom: 20 }}>Applying as <strong style={{ color: 'var(--cream)' }}>{loggedInEmail}</strong>.</p>
      ) : (
        <div className="pp-grid-2" style={{ gap: '0 20px' }}>
          <label className="pp-field"><span className="pp-label">Email *</span>
            <input className="pp-input" name="email" type="email" required autoComplete="email" /></label>
          <label className="pp-field"><span className="pp-label">Password *</span>
            <input className="pp-input" name="password" type="password" required minLength={8} autoComplete="new-password" />
            <span className="pp-hint">At least 8 characters. You&apos;ll use this to log in.</span></label>
        </div>
      )}

      <p className="pp-h3" style={{ marginTop: 12 }}>Business details</p>
      <div className="pp-grid-2" style={{ gap: '0 20px' }}>
        <label className="pp-field"><span className="pp-label">Business name *</span>
          <input className="pp-input" name="business_name" required maxLength={200} /></label>
        <label className="pp-field"><span className="pp-label">Contact person *</span>
          <input className="pp-input" name="contact_name" required maxLength={200} autoComplete="name" /></label>
        <label className="pp-field"><span className="pp-label">Mobile number *</span>
          <input className="pp-input" name="phone" type="tel" required maxLength={50} autoComplete="tel" placeholder="09xx xxx xxxx" /></label>
        <label className="pp-field"><span className="pp-label">TIN</span>
          <input className="pp-input" name="tin" maxLength={50} placeholder="Optional" /></label>
        <label className="pp-field"><span className="pp-label">Business type</span>
          <select className="pp-select" name="business_type" defaultValue="">
            <option value="">Select…</option>
            {Object.entries(BUSINESS_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label className="pp-field"><span className="pp-label">Expected cases per month</span>
          <input className="pp-input" name="expected_monthly_cases" type="number" min={0} step={1} />
          <span className="pp-hint">1 case = 12 boxes</span></label>
      </div>

      <label className="pp-field"><span className="pp-label">Business / delivery address</span>
        <input className="pp-input" name="address" maxLength={300} autoComplete="street-address" /></label>
      <div className="pp-grid-2" style={{ gap: '0 20px' }}>
        <label className="pp-field"><span className="pp-label">City *</span>
          <input className="pp-input" name="city" required maxLength={100} /></label>
        <label className="pp-field"><span className="pp-label">Province</span>
          <input className="pp-input" name="province" maxLength={100} /></label>
      </div>
      <label className="pp-field"><span className="pp-label">Where will you sell Sensarè?</span>
        <input className="pp-input" name="sales_channels" maxLength={500} placeholder="e.g. our boutique in Makati, Shopee store, Instagram" /></label>
      <label className="pp-field"><span className="pp-label">Anything else we should know?</span>
        <textarea className="pp-textarea" name="message" maxLength={2000} /></label>

      {/* honeypot */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} />

      <label className="pp-row" style={{ marginBottom: 20, alignItems: 'flex-start', gap: 10, flexWrap: 'nowrap' }}>
        <input type="checkbox" name="agree" required style={{ marginTop: 4 }} />
        <span className="pp-muted">I confirm the details above are accurate and agree to Sensarè&apos;s partner terms, including selling at or above the recommended retail price.</span>
      </label>

      <SubmitButton pendingText="Submitting…" className="pp-btn pp-btn-block">Submit application</SubmitButton>
    </form>
  )
}
