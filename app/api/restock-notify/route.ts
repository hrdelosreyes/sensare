import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { email, productId } = await req.json()
    if (!email || !productId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const error = await db()`
      insert into sensare_restock_notifications (email, product_id)
      values (${String(email).toLowerCase()}, ${productId}::uuid)
      on conflict (email, product_id) do nothing`.then(() => null, (e: unknown) => e)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Restock notify error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
