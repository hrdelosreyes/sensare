import { requireApprovedPartnerPage } from '@/lib/auth'
import { getLocations } from '@/lib/partner-data'
import { buildReport, parseRange } from '@/lib/reports'
import { locationLabel } from '@/lib/partner'
import ReportView from '@/components/portal/ReportView'

export default async function PartnerReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string; loc?: string }> }) {
  const partner = await requireApprovedPartnerPage()
  const sp = await searchParams
  const range = parseRange(sp)
  const locations = await getLocations(partner.id, false)
  const loc = locations.find(l => l.id === sp.loc) ?? null
  const report = await buildReport(partner.id, range, loc?.id ?? null)
  const qs = `preset=${range.preset}&from=${range.from}&to=${range.to}${loc ? `&loc=${loc.id}` : ''}`
  return (
    <>
      <p className="pp-print-only" style={{ fontWeight: 700, fontSize: 18 }}>Sensarè Partner Report — {partner.business_name}{loc ? ` · ${locationLabel(loc)}` : ''}</p>
      <ReportView report={report} title={loc ? `Reports · ${locationLabel(loc)}` : 'Reports'} csvHref={kind => `/api/partner/reports?kind=${kind}&${qs}`}
        filters={locations.length > 1 ? (
          <label><span className="pp-label">Branch</span>
            <select className="pp-select" name="loc" defaultValue={loc?.id ?? ''} style={{ width: 'auto' }}>
              <option value="">All branches</option>
              {locations.map(l => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}
            </select></label>
        ) : undefined} />
    </>
  )
}
