'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// FR-007 / AC-005. Generic invalid-credentials error (§6.5, TC-ACC-011) —
// wrong password and non-existent email must be indistinguishable, for
// basic account-enumeration hygiene. No password-recovery link this Beta
// (§2.5 note) — self-service recovery is explicitly out of scope.
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl text-foreground">Welcome back</h1>
        <p className="mt-1 text-base text-muted-foreground">Log in to your Vizazi Care account.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input label="Email address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm status-error">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        )}

        <Button type="submit" loading={submitting} loadingText="Logging in…" className="w-full">
          Log in
        </Button>
      </form>

      <p className="text-center text-base text-muted-foreground">
        New to Vizazi Care?{' '}
        <Link href="/sign-up" className="font-medium text-sage-700 underline">
          Create an account
        </Link>
      </p>
    </main>
  )
}
