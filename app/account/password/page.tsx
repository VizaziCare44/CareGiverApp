import { createClient } from '@/lib/supabase/server'
import { AppBar } from '@/components/ui/app-bar'
import { ChangePasswordForm } from '@/components/account/change-password-form'
import { homeFor } from '@/lib/route-guard'

// Change password, for anyone signed in (a Family Member, a Caregiver or an Admin; lib/route-guard.ts SIGNED_IN_PATHS).
// A provisioned account starts with a temporary password (docs/Account Provisioning Runbook.md); this is where its
// owner replaces it. Signed out, middleware sends the visitor to Log In. The way back is the person's own home.
export default async function ChangePasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select('role').eq('id', user.id).single() : { data: null }
  const home = homeFor(profile?.role) ?? '/'

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-white text-figma-ink">
      <AppBar title="Change password" backHref={home} backLabel="Back" />
      <h1 className="sr-only">Change password</h1>
      <ChangePasswordForm backHref={home} backLabel="Back to the app" />
    </div>
  )
}
