'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ActionButton } from '@/components/ui/action-button'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Field } from '@/components/ui/field'
import { TextLink } from '@/components/ui/text-link'

// FR-007 / AC-005, frames ACC-02 and ACC-02b. Generic invalid-credentials error (§6.5, TC-ACC-011) —
// wrong password and non-existent email must be indistinguishable, for
// basic account-enumeration hygiene. Password recovery (DEV-027) reverses
// FD-ACC §2.5/§3.5's original Beta-scope exclusion, per founder decision
// 2026-10-01 — the forgot-password link below is intentional, not drift.
const GENERIC_ERROR = 'Email or password incorrect.'

export default function LogInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(GENERIC_ERROR)
      setSubmitting(false)
      return
    }

    router.push('/recipients')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white text-figma-ink">
      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4 p-5">
        <h1 className="text-[24px] font-bold leading-[1.25]">Log in</h1>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <Field label="Email" type="email" placeholder="name@example.com" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" placeholder="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />

        {/* DEV-027, founder decision 2026-10-01: the frames predate it, so it is not drawn there; it sits under the fields as a text link */}
        <TextLink href="/forgot-password" className="self-start">
          Forgot password?
        </TextLink>

        <div className="flex-1" />
        <ActionButton type="submit" disabled={submitting} aria-busy={submitting || undefined} className="w-full">
          {submitting ? 'Logging in…' : 'Log in'}
        </ActionButton>
        <TextLink href="/sign-up" block>
          New here? Create an account
        </TextLink>
      </form>
    </main>
  )
}
