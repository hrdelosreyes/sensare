import { NextResponse, type NextRequest } from 'next/server'
import { getAdmin } from '@/lib/auth'
import { buildReport, parseRange, reportCsv } from '@/lib/reports'
import { reportScope } from '@/lib/admin-scope'
import { can } from '@/lib/roles'

export async function GET(req: NextRequest) {
  const admin = await getAdmin()
  if (!admin || !can(admin.role, 'reports.view')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = Object.fromEntries(req.nextUrl.searchParams)
  const { partners, scopeIds } = await reportScope(admin)
  const partnerId = partners.some(p => p.id === sp.partner) ? sp.partner : null
  if (sp.partner && !partnerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const out = reportCsv(await buildReport(partnerId, parseRange(sp), null, scopeIds), sp.kind)
  if (!out) return NextResponse.json({ error: 'Unknown report' }, { status: 400 })
  return new NextResponse(out.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${out.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
