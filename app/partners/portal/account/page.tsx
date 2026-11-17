import { requireApprovedPartnerPage } from '@/lib/auth'
import { BUSINESS_TYPES, fmtDate, PAYMENT_TERMS } from '@/lib/partner'
import AccountForm from './AccountForm'
import ResetForm from '../../reset-password/ResetForm'

export default async function AccountPage() {
  const partner = await requireApprovedPartnerPage()
  return (
    <div className="pp-stack">
      <h1 className="pp-h1">Account</h1>
      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Business</p>
          <dl className="pp-dl">
            <dt>Business name</dt><dd>{partner.business_name}</dd>
            <dt>Login email</dt><dd>{partner.email}</dd>
            <dt>TIN</dt><dd>{partner.tin || '—'}</dd>
            <dt>Type</dt><dd>{partner.business_type ? BUSINESS_TYPES[partner.business_type] ?? partner.business_type : '—'}</dd>
            <dt>Default terms</dt><dd>{PAYMENT_TERMS[partner.default_payment_terms]}</dd>
            <dt>Partner since</dt><dd>{fmtDate(partner.reviewed_at || partner.created_at)}</dd>
          </dl>
          <p className="pp-hint" style={{ marginTop: 14 }}>To change your business name, TIN or payment terms, email mysensare@gmail.com.</p>
          <p className="pp-h2" style={{ marginTop: 28 }}>Change password</p>
          <ResetForm mode="change" />
        </div>
        <div className="pp-card">
          <p className="pp-h2">Contact & delivery details</p>
          <AccountForm partner={partner} />
        </div>
      </div>
    </div>
  )
}
