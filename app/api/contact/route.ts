import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json()
    if (!name || !email || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Sensarè Contact <noreply@mysensare.com>',
      to: 'hello@mysensare.com',
      replyTo: email,
      subject: `Contact from ${name}`,
      html: `<p><strong>From:</strong> ${name} (${email})</p><p><strong>Message:</strong></p><p>${message.replace(/\n/g, '<br/>')}</p>`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Contact error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
