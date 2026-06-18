import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin()
      .from('sensare_products')
      .select('id, name, stock_qty')

    return NextResponse.json({ data, error, url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) })
  } catch (err) {
    return NextResponse.json({ caught: String(err) })
  }
}
