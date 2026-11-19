import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * VIZ-201: Log out. Ends THIS device's session only (scope 'local'), so the same person signed in on another phone
 * or browser stays signed in, then sends the browser to Log In.
 *
 * - POST only: there is no GET export, so Next answers a GET (a link, a prefetch, an <img>) with 405 and signs nobody out.
 * - Same origin only: a POST that names another site as its Origin is refused with 403. A browser always sends Origin
 *   on a form POST; if it is missing, Sec-Fetch-Site must say same-origin, otherwise the request is refused too.
 * - 303 See Other, so the browser follows with a GET to /log-in rather than repeating the POST.
 *
 * /auth/* is open to the middleware (the confirm route has to work signed out), so the check lives here.
 */
function isSameOrigin(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  return request.headers.get('sec-fetch-site') === 'same-origin'
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return new NextResponse('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: new URL('/log-in', request.url).toString(), 'Cache-Control': 'no-store' },
  })

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      // signOut clears the session cookies; they go on the redirect so the browser drops them
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  await supabase.auth.signOut({ scope: 'local' })
  return response
}
