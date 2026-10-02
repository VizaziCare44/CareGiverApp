'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// DEV-027. Generic "check your email" outcome regardless of whether the
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
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl text-foreground">Check your email</h1>
        <p className="text-lg text-muted-foreground">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password.
        </p>
        <Link href="/log-in" className="font-medium text-sage-700 underline">
          Back to log in
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl text-foreground">Reset your password</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input label="Email address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

        <Button type="submit" loading={submitting} loadingText="Sending…" className="w-full">
          Send reset link
        </Button>
      </form>

      <p className="text-center text-base text-muted-foreground">
        <Link href="/log-in" className="font-medium text-sage-700 underline">
          Back to log in
        </Link>
      </p>
    </main>
  )
}
