'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ActionButton } from '@/components/ui/action-button'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Field } from '@/components/ui/field'
import { NoticeScreen } from '@/components/ui/notice-screen'
import { TextLink } from '@/components/ui/text-link'

// FR-001 / AC-001, frames ACC-01 and ACC-01b. Inline, on-blur validation per FD-ACC §6.5 — errors stay
// next to the field they belong to (the box turns red, an icon and the message sit under it); invalid input never
// creates an account.
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
    fullName: touched.fullName && !fullName.trim() ? 'Enter your full name' : undefined,
    email: touched.email && !EMAIL_RE.test(email) ? 'Enter a valid email address, like name@example.com' : undefined,
    phone: touched.phone && !phone.trim() ? 'Enter your phone number' : undefined,
    password: touched.password && password.length < 8 ? 'Password must be at least 8 characters' : undefined,
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
        data: { full_name: fullName, phone },
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
      <NoticeScreen title="Check your email">
        We sent a confirmation link to <strong>{email}</strong>. Follow it to activate your account.
      </NoticeScreen>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white text-figma-ink">
      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4 p-5">
        <h1 className="text-[24px] font-bold leading-[1.25]">Create your account</h1>

        {formError && <ErrorBanner testId="form-error">{formError}</ErrorBanner>}

        <Field
          label="Full name"
          placeholder="Full name"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
          error={errors.fullName}
        />
        <Field
          label="Email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={errors.email}
        />
        <Field
          label="Phone number"
          type="tel"
          placeholder="Phone number"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          error={errors.phone}
        />
        <Field
          label="Password"
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={errors.password}
        />

        <div className="flex-1" />
        <ActionButton type="submit" disabled={submitting} aria-busy={submitting || undefined} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </ActionButton>
        <TextLink href="/log-in" block>
          Already have an account? Log in
        </TextLink>
      </form>
    </main>
  )
}
