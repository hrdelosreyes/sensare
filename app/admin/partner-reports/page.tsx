import { requireAdminPage } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildReport, parseRange } from '@/lib/reports'
import ReportView from '@/components/portal/ReportView'

export default async function AdminPartnerReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string; partner?: string }> }) {
  await requireAdminPage()
  const sp = await searchParams
  const range = parseRange(sp)
  const partners = await db()<{ id: string; business_name: string }[]>`select id, business_name from sensare_partners where status in ('approved', 'suspended') order by business_name`
  const partnerId = partners.some(p => p.id === sp.partner) ? sp.partner! : null
  const report = await buildReport(partnerId, range)
  const name = partners.find(p => p.id === partnerId)?.business_name
  const qs = `preset=${range.preset}&from=${range.from}&to=${range.to}${partnerId ? `&partner=${partnerId}` : ''}`

  return (
    <>
      <p className="pp-print-only" style={{ fontWeight: 700, fontSize: 18 }}>Sensarè Partner Report — {name ?? 'All partners'}</p>
      <ReportView
        report={report}
        title={name ? `Reports · ${name}` : 'Partner reports'}
        csvHref={kind => `/api/admin/partner-reports?kind=${kind}&${qs}`}
        filters={
          <label><span className="pp-label">Partner</span>
            <select className="pp-select" name="partner" defaultValue={partnerId ?? ''} style={{ width: 'auto' }}>
              <option value="">All partners</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.business_name}</option>)}
            </select></label>
        }
      />
    </>
  )
}
