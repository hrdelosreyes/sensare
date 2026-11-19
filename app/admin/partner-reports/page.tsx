import { requireAdminPage } from '@/lib/auth'
import { reportScope } from '@/lib/admin-scope'
import { buildReport, parseRange } from '@/lib/reports'
import ReportView from '@/components/portal/ReportView'

export default async function AdminPartnerReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string; partner?: string }> }) {
  const admin = await requireAdminPage('reports.view')
  const sp = await searchParams
  const range = parseRange(sp)
  const { partners, scopeIds } = await reportScope(admin)
  const partnerId = partners.some(p => p.id === sp.partner) ? sp.partner! : null
  const report = await buildReport(partnerId, range, null, scopeIds)
  const name = partners.find(p => p.id === partnerId)?.business_name
  const qs = `preset=${range.preset}&from=${range.from}&to=${range.to}${partnerId ? `&partner=${partnerId}` : ''}`

  return (
    <>
      <p className="pp-print-only" style={{ fontWeight: 700, fontSize: 18 }}>Sensarè Partner Report — {name ?? 'All partners'}</p>
      <ReportView
        report={report}
        title={name ? `Reports · ${name}` : admin.role === 'account_manager' ? 'My accounts · reports' : 'Partner reports'}
        csvHref={kind => `/api/admin/partner-reports?kind=${kind}&${qs}`}
        filters={
          <label><span className="pp-label">Partner</span>
            <select className="pp-select" name="partner" defaultValue={partnerId ?? ''} style={{ width: 'auto' }}>
              <option value="">{admin.role === 'account_manager' ? 'All my accounts' : 'All partners'}</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.business_name}</option>)}
            </select></label>
        }
      />
    </>
  )
}
