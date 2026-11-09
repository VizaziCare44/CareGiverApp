'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ActionButton } from '@/components/ui/action-button'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Field } from '@/components/ui/field'

// DEV-027, frames ACC-14 and ACC-14b. Reached only via the recovery email link, which /auth/confirm
// verifies and turns into a real (if short-lived) session before
// redirecting here — so by the time this page renders, updateUser() below
// is operating on an authenticated session, not a token in the URL.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordError = touched && password.length < 8 ? 'Password must be at least 8 characters' : undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (password.length < 8 || submitting) return
    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    router.push('/recipients')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white text-figma-ink">
      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4 p-5">
        <h1 className="text-[24px] font-bold leading-[1.25]">Set a new password</h1>
        <p className="text-[16px] leading-[1.4] text-figma-muted">Choose a new password for your account.</p>

        {error && <ErrorBanner testId="form-error">{error}</ErrorBanner>}

        <Field
          label="New password"
          type="password"
          placeholder="New password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched(true)}
          error={passwordError}
        />

        <div className="flex-1" />
        <ActionButton type="submit" disabled={submitting} aria-busy={submitting || undefined} className="w-full">
          {submitting ? 'Saving…' : 'Save new password'}
        </ActionButton>
      </form>
    </main>
  )
}
