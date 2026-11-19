import { NextRequest, NextResponse } from 'next/server'
import { email as mail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json()
    if (!name || !email || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Goes to the shop inbox; replying answers the customer directly.
    await mail.contactMessage({ name: String(name), email: String(email), message: String(message) })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Contact error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
