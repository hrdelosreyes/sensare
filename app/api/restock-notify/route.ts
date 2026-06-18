import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, productId } = await req.json()
    if (!email || !productId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { error } = await supabaseAdmin().from('restock_notifications').upsert(
      { email: email.toLowerCase(), product_id: productId },
      { onConflict: 'email,product_id', ignoreDuplicates: true }
    )

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Restock notify error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
