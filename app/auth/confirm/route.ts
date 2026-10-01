import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Confirmation-email link target for the PKCE flow (Supabase's own guide:
 * "Email based Auth with PKCE flow for SSR"). Confirmed this project uses
 * PKCE — auth.users.confirmation_token is stored with a `pkce_` prefix,
 * which is the same token_hash value the default "Confirm signup" template
 * emails as {{ .TokenHash }} in a link to {{ .SiteURL }}/auth/confirm.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/recipients'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      redirect(next)
    }
  }

  redirect('/auth/auth-code-error')
}
