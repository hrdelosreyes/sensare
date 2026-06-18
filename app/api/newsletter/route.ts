import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    await supabaseAdmin().from('sensare_newsletter_subscribers')
      .upsert({ email: email.toLowerCase() }, { onConflict: 'email', ignoreDuplicates: true })

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Sensarè Chocolates <noreply@mysensare.com>',
      to: email,
      subject: 'Your Sensarè Ritual Guide ♥',
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#1c0e09;color:#faf0e4;padding:40px 32px;">
          <h2 style="color:#c9906a;font-size:28px;margin-bottom:16px;">The Sensarè Ritual Guide</h2>
          <p style="color:#e8d8c4;font-size:16px;line-height:1.8;margin-bottom:24px;">Thank you for joining the Sensarè community. Here's your free ritual guide.</p>
          <div style="border-left:3px solid #c9906a;padding-left:20px;margin-bottom:24px;">
            <p style="color:#c9906a;font-weight:bold;margin-bottom:8px;">The Five Steps</p>
            <p style="color:#e8d8c4;font-size:14px;line-height:1.9;">
              01 · Set the Scene — Dim lights, candle, phones off.<br/>
              02 · Unwrap with Intention — Slow down. Breathe. Eye contact.<br/>
              03 · Savor Slowly — Small bites. Let it melt. Describe the taste.<br/>
              04 · Touch, Speak, Connect — "What do you feel? What do you desire?"<br/>
              05 · Ignite — Let the evening unfold naturally.
            </p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/shop" style="display:inline-block;padding:14px 32px;background:#c9906a;color:#0f0705;font-family:Georgia,serif;font-weight:bold;text-decoration:none;border-radius:2px;letter-spacing:1px;">
            Shop the Collection
          </a>
          <p style="font-size:12px;color:#a08070;margin-top:32px;font-style:italic;">Unwrap. Savor. Ignite. ♥</p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Newsletter error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
