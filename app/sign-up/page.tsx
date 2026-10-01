'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// FR-001 / AC-001. Inline, on-blur validation per FD-ACC §6.5 — errors stay
// next to the field they belong to; invalid input never creates an account.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignUpPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)

  const errors = {
    fullName: touched.fullName && !fullName.trim() ? 'Enter your full name.' : undefined,
    email: touched.email && !EMAIL_RE.test(email) ? 'Enter a valid email address.' : undefined,
    phone: touched.phone && !phone.trim() ? 'Enter your phone number.' : undefined,
    password: touched.password && password.length < 8 ? 'Password must be at least 8 characters.' : undefined,
  }

  const isValid = fullName.trim() && EMAIL_RE.test(email) && phone.trim() && password.length >= 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ fullName: true, email: true, phone: true, password: true })
    if (!isValid || submitting) return

    setSubmitting(true)
    setFormError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone, role: 'family_member' },
        emailRedirectTo: `${window.location.origin}/recipients`,
      },
    })

    if (error) {
      setFormError(error.message)
      setSubmitting(false)
      return
    }

    // Email confirmation required: signUp() creates the account but issues
    // no session until the confirmation link is followed. Route only when a
    // session actually exists — otherwise tell the FM to check their inbox
    // rather than send them into a flow they can't access yet.
    if (!data.session) {
      setCheckEmail(true)
      setSubmitting(false)
      return
    }

    router.push('/recipients')
    router.refresh()
  }

  if (checkEmail) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl text-foreground">Check your email</h1>
        <p className="text-lg text-muted-foreground">
          We sent a confirmation link to <strong>{email}</strong>. Follow it to activate your account.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl text-foreground">Create your account</h1>
        <p className="mt-1 text-base text-muted-foreground">So Vizazi Care can identify you and your bookings.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label="Full name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
          error={errors.fullName}
        />
        <Input
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={errors.email}
        />
        <Input
          label="Phone number"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          error={errors.phone}
        />
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={errors.password}
          hint="At least 8 characters."
        />

        {formError && (
          <p role="alert" className="flex items-center gap-1.5 text-sm status-error">
            <span aria-hidden="true">⚠</span>
            {formError}
          </p>
        )}

        <Button type="submit" loading={submitting} className="w-full">
          Sign up
        </Button>
      </form>

      <p className="text-center text-base text-muted-foreground">
        Already have an account?{' '}
        <Link href="/log-in" className="font-medium text-sage-700 underline">
          Log in
        </Link>
      </p>
    </main>
  )
}
