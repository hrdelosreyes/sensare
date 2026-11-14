import { NextResponse, type NextRequest } from 'next/server'
import { getPartner } from '@/lib/auth'
import { buildReport, parseRange, reportCsv } from '@/lib/reports'

export async function GET(req: NextRequest) {
  const partner = await getPartner()
  if (!partner || partner.status !== 'approved') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = Object.fromEntries(req.nextUrl.searchParams)
  const report = await buildReport(partner.id, parseRange(sp))
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
