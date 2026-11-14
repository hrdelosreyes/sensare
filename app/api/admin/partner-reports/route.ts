import { NextResponse, type NextRequest } from 'next/server'
import { getAdmin } from '@/lib/auth'
import { buildReport, parseRange, reportCsv } from '@/lib/reports'

export async function GET(req: NextRequest) {
  if (!(await getAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = Object.fromEntries(req.nextUrl.searchParams)
  const partnerId = sp.partner && /^[0-9a-f-]{36}$/i.test(sp.partner) ? sp.partner : null
  const out = reportCsv(await buildReport(partnerId, parseRange(sp)), sp.kind)
  if (!out) return NextResponse.json({ error: 'Unknown report' }, { status: 400 })
  return new NextResponse(out.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${out.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
