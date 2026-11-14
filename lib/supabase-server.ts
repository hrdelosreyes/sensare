import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Supabase client bound to the visitor's auth cookies. Use for auth calls
// (getUser, signIn, signOut). Data access goes through supabaseAdmin() after
// an explicit authorization check in lib/auth.ts.
export async function supabaseAuth() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component — cookies are read-only there.
            // proxy.ts refreshes the session, so this is safe to ignore.
          }
        },
      },
    }
  )
}
