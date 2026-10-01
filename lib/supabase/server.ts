import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server Component / Server Action Supabase client — reads/writes the
// httpOnly session cookie via Next's cookies() API. RLS (not this client)
// is the actual access-control boundary; this just carries the caller's
// identity to Postgres.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // called from a Server Component that can't set cookies — safe to
          // ignore as long as middleware.ts is refreshing the session
        }
      },
    },
  })
}
