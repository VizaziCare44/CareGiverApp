'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ActionButton } from '@/components/ui/action-button'
import { Field } from '@/components/ui/field'
import { NoticeScreen } from '@/components/ui/notice-screen'
import { TextLink } from '@/components/ui/text-link'

// DEV-027, frames ACC-13 and ACC-13b. Generic "check your email" outcome regardless of whether the
// address has an account — Supabase's resetPasswordForEmail() itself
// doesn't reveal that either, same account-enumeration hygiene as the
// log-in screen's generic error (§6.5).
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || !email.trim()) return
    setSubmitting(true)

    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })

    setSubmitting(false)
    setSent(true)
  }

  if (sent) {
    return (
      <NoticeScreen
        title="Check your email"
        action={
          <TextLink href="/log-in" block>
            Back to log in
          </TextLink>
        }
      >
        If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password.
      </NoticeScreen>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white text-figma-ink">
      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4 p-5">
        <h1 className="text-[24px] font-bold leading-[1.25]">Reset your password</h1>
        <p className="text-[16px] leading-[1.4] text-figma-muted">Enter your email and we&apos;ll send you a link to reset it.</p>

        <Field label="Email" type="email" placeholder="name@example.com" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

        <div className="flex-1" />
        <ActionButton type="submit" disabled={submitting} aria-busy={submitting || undefined} className="w-full">
          {submitting ? 'Sending…' : 'Send reset link'}
        </ActionButton>
        <TextLink href="/log-in" block>
          Back to log in
        </TextLink>
      </form>
    </main>
  )
}
