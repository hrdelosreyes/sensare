import { requireApprovedPartnerPage } from '@/lib/auth'
import { buildReport, parseRange } from '@/lib/reports'
import ReportView from '@/components/portal/ReportView'

export default async function PartnerReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string }> }) {
  const partner = await requireApprovedPartnerPage()
  const range = parseRange(await searchParams)
  const report = await buildReport(partner.id, range)
  const qs = `preset=${range.preset}&from=${range.from}&to=${range.to}`
  return (
    <>
      <p className="pp-print-only" style={{ fontWeight: 700, fontSize: 18 }}>Sensarè Partner Report — {partner.business_name}</p>
      <ReportView report={report} title="Reports" csvHref={kind => `/api/partner/reports?kind=${kind}&${qs}`} />
    </>
  )
}
