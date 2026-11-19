import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { email as mail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    const address = String(email).trim().toLowerCase()

    const added = await db()`insert into sensare_newsletter_subscribers (email) values (${address})
      on conflict (email) do nothing returning email`

    await mail.ritualGuide(address)
    if (added.length) await mail.newsletterSignup(address)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Newsletter error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
