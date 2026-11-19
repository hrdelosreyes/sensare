import { NextResponse, type NextRequest } from 'next/server'
import { getPartnerAccess } from '@/lib/auth'
import { buildReport, parseRange, reportCsv } from '@/lib/reports'
import { getLocations } from '@/lib/partner-data'

export async function GET(req: NextRequest) {
  const access = await getPartnerAccess()
  const partner = access?.role === 'owner' ? access.partner : null
  if (!partner || partner.status !== 'approved') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = Object.fromEntries(req.nextUrl.searchParams)
  const loc = sp.loc ? (await getLocations(partner.id, false)).find(l => l.id === sp.loc) : undefined
  const report = await buildReport(partner.id, parseRange(sp), loc?.id ?? null)
  const kind = sp.kind === 'partners' ? '' : sp.kind
  const out = reportCsv(report, kind)
  if (!out) return NextResponse.json({ error: 'Unknown report' }, { status: 400 })
  return new NextResponse(out.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${out.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
