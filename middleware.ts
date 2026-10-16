import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/sign-up', '/log-in', '/forgot-password']
const AUTH_PREFIX = '/auth/'
const ADMIN_PREFIX = '/admin'
const FAMILY_PREFIXES = ['/recipients', '/book']

/**
 * CSP note: nonce-based `script-src` was tried and reverted. Per Next.js's
 * own docs, a nonce only reaches a page's scripts if that page is
 * dynamically rendered — Next bakes its framework/hydration scripts in at
 * build time for statically-generated pages (sign-up, log-in, bundle,
 * datetime, confirmation are all static here), so no per-request nonce can
 * ever attach to them. Forcing every page dynamic just to support a nonce
 * would drop static optimization app-wide — disproportionate hardening for
 * this Beta: there's no dangerouslySetInnerHTML, no user-controlled HTML
 * rendering anywhere in this codebase, and React escapes all output by
 * default, so the realistic inline-script-injection surface `'unsafe-inline'`
 * would protect against isn't present without an XSS bug elsewhere first.
 * The rest of the policy (frame-ancestors, base-uri, form-action, scoped
 * connect-src) still does real work and stays strict.
 *
 * 'unsafe-eval' is added in development only: Next.js's React Fast Refresh
 * runtime evaluates code via eval() to wire up hot-reloading, which a strict
 * script-src silently blocks — the EvalError aborts client-side hydration
 * entirely, so pages render but no event handlers ever attach (discovered
 * via the log-in button doing nothing: no request to Supabase ever fired).
 * Production builds don't use eval-based Fast Refresh, so this widening
 * never reaches deployed traffic.
 */
// connect-src follows the configured project's origin so the same build works
// against hosted Supabase and the local stack CI starts (http://127.0.0.1:54321).
const SUPABASE_ORIGIN = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin

const CSP = `default-src 'self'; script-src 'self' 'unsafe-inline'${
  process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${SUPABASE_ORIGIN}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`

// RBAC route guarding (FD-ACC §7.4 / DEV-012) + session refresh, per
// docs/Platform Engineer Skill NextJS.MD's App Router pattern. Role checks
// here are a UX convenience (fast redirect) — RLS in Postgres is the real
// authorization boundary, not this middleware.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.includes(pathname)

  // /auth/confirm and /auth/auth-code-error must be reachable while
  // unauthenticated regardless of the isPublic/redirect logic below — the
  // confirm route handler is what *establishes* the session in the first
  // place (§ handle_new_user trigger's the profile row, this route verifies
  // the PKCE token_hash and sets the cookie).
  if (pathname.startsWith(AUTH_PREFIX)) {
    return applySecurityHeaders(response)
  }

  if (!user) {
    if (!isPublic && pathname !== '/') {
      return NextResponse.redirect(new URL('/log-in', request.url))
    }
    return applySecurityHeaders(response)
  }

  // authenticated — fetch role for route gating
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  if (isPublic || pathname === '/') {
    return NextResponse.redirect(new URL(role === 'admin' ? '/admin/queue' : '/recipients', request.url))
  }

  if (pathname.startsWith(ADMIN_PREFIX) && role !== 'admin') {
    return NextResponse.redirect(new URL('/recipients', request.url))
  }

  if (FAMILY_PREFIXES.some((p) => pathname.startsWith(p)) && role !== 'family_member') {
    return NextResponse.redirect(new URL(role === 'admin' ? '/admin/queue' : '/log-in', request.url))
  }

  return applySecurityHeaders(response)
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set('Content-Security-Policy', CSP)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
