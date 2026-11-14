import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAuth } from '@/lib/supabase-server'

// Handles Supabase email links (password reset). Exchanges the one-time code
// for a session cookie, then sends the user on to `next`.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const nextParam = url.searchParams.get('next') || '/partners/portal'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/partners/portal'

  if (code) {
    const sb = await supabaseAuth()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }
  return NextResponse.redirect(new URL('/partners/login?error=link', url.origin))
}
