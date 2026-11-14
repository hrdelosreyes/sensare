import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!(await getAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { productId, stock } = await req.json()
  const { error } = await supabaseAdmin().from('sensare_products').update({ stock_qty: stock }).eq('id', productId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
