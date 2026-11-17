import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdmin } from '@/lib/auth'
import { can } from '@/lib/roles'

export async function POST(req: NextRequest) {
  const admin = await getAdmin()
  if (!admin || !can(admin.role, 'store.stock')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { productId, stock } = await req.json()
  const qty = Math.floor(Number(stock))
  if (!Number.isFinite(qty) || qty < 0) return NextResponse.json({ error: 'Invalid stock' }, { status: 400 })
  try {
    await db()`update sensare_products set stock_qty = ${qty} where id = ${productId}::uuid`
  } catch (e) {
    console.error('Stock update failed', e)
    return NextResponse.json({ error: 'Could not update stock' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
