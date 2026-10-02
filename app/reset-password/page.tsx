'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// DEV-027. Reached only via the recovery email link, which /auth/confirm
// verifies and turns into a real (if short-lived) session before
// redirecting here — so by the time this page renders, updateUser() below
// is operating on an authenticated session, not a token in the URL.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordError = touched && password.length < 8 ? 'Password must be at least 8 characters.' : undefined

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl text-foreground">Set a new password</h1>
        <p className="mt-1 text-base text-muted-foreground">Choose a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label="New password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched(true)}
          error={passwordError}
          hint="At least 8 characters."
        />

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm status-error">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        )}

        <Button type="submit" loading={submitting} loadingText="Saving…" className="w-full">
          Save new password
        </Button>
      </form>
    </main>
  )
}
