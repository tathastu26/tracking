import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const requestUrl = new URL(request.url)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env in middleware', {
      hasUrl: Boolean(supabaseUrl),
      hasKey: Boolean(supabaseKey),
    })
    return response
  }

  const supabase = createMiddlewareClient(
    { req: request, res: response },
    { supabaseUrl, supabaseKey }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect profile route
  // NOTE: Temporarily bypassing auth for the dashboard (root '/') so the
  // developer can preview the map UI without signing in. Remove this bypass
  // or guard it behind an env flag before deploying to production.
  if (requestUrl.pathname.startsWith('/profile') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-in users away from login/signup pages
  if (
    (requestUrl.pathname === '/login' || requestUrl.pathname === '/signup') &&
    user
  ) {
    return NextResponse.redirect(new URL('/profile', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/profile/:path*',
    '/login',
    '/signup',
  ],
}
