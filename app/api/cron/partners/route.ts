import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { refreshSuggestion } from '@/lib/forecast'
import { getConsignmentState, previewSettlement } from '@/lib/consignment'
import { email } from '@/lib/email'
import type { Partner } from '@/lib/partner'

// Daily job (vercel.json → crons). Vercel sends `Authorization: Bearer $CRON_SECRET`.
//  1. Refreshes every approved partner's suggested order (emails when a new one opens).
//  2. Reminds consignment partners when a settlement period has passed.
export const maxDuration = 300

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = supabaseAdmin()
  const { data } = await db.from('sensare_partners').select('*').eq('status', 'approved')
  const partners = (data ?? []) as Partner[]
  const result = { partners: partners.length, suggestions: 0, reminders: 0, errors: 0 }

  for (const p of partners) {
    try {
      if (await refreshSuggestion(p, true)) result.suggestions++

      const st = await getConsignmentState(p)
      const remindedRecently = !!p.consignment_reminded_at
        && Date.now() - Date.parse(p.consignment_reminded_at) < st.periodDays * 86400000
      if (st.isDue && st.nextFrom && st.defaultTo && !remindedRecently) {
        const lines = await previewSettlement(p.id, st.nextFrom, st.defaultTo)
        const amount = lines.reduce((s, l) => s + l.amount_php, 0)
        if (amount > 0) {
          await email.consignmentReminder(p, st.nextFrom, st.defaultTo, amount)
          await db.from('sensare_partners').update({ consignment_reminded_at: new Date().toISOString() }).eq('id', p.id)
          result.reminders++
        }
      }
    } catch (e) {
      result.errors++
      console.error('Partner cron failed for', p.id, e)
    }
  }
  return NextResponse.json(result)
}
