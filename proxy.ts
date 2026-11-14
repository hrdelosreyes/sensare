import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Keeps the Supabase auth session fresh for the partner portal and admin.
// Authorization itself is enforced in each page / server action (lib/auth.ts).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    }
  )

  // Refreshes the access token if it has expired.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/partners/:path*', '/admin/:path*', '/api/partner/:path*', '/api/admin/:path*'],
}
