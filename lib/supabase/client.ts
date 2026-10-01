import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client. Session lives in secure cookies managed by
// @supabase/ssr — never localStorage — per the platform/security skills'
// session-state rule.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
