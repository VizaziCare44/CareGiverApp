'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ActionButton } from '@/components/ui/action-button'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Field } from '@/components/ui/field'
import { NoticeScreen } from '@/components/ui/notice-screen'
import { TextLink } from '@/components/ui/text-link'

const MIN_LENGTH = 8

// A signed-in person chooses their own password: the one they were handed (the temporary password of a
// provisioned account, DEV-035) or any other. The current password is asked for and checked first, so a
// session left open on a shared phone cannot be used to take the account over; then the new one is saved.
// Built in the style of the account frames (ACC-01, ACC-14): the same fields, button and error states. The
// frames do not draw this screen yet (docs/FD-ACC Section D Frame Spec.md).
export function ChangePasswordForm({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [touched, setTouched] = useState({ current: false, next: false, again: false })
  const [currentWrong, setCurrentWrong] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const currentError = currentWrong ? "That isn't your current password" : touched.current && current === '' ? 'Enter your current password' : undefined
  const nextError =
    touched.next && next.length < MIN_LENGTH
      ? `Password must be at least ${MIN_LENGTH} characters`
      : touched.next && next === current && current !== ''
        ? 'Choose a password different from your current one'
        : undefined
  const againError = touched.again && again !== next ? "The passwords don't match" : undefined

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ current: true, next: true, again: true })
    if (submitting || current === '' || next.length < MIN_LENGTH || next === current || again !== next) return
    setSubmitting(true)
    setError(null)
    setCurrentWrong(false)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      setError('Your session has ended. Please log in again.')
      setSubmitting(false)
      return
    }

    // the current password is checked by signing in with it; the session it returns is the same person's
    const check = await supabase.auth.signInWithPassword({ email: user.email, password: current })
    if (check.error) {
      if (check.error.status === 400 || /invalid/i.test(check.error.message)) setCurrentWrong(true)
      else setError("Couldn't save — check your connection and try again")
      setSubmitting(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    setDone(true)
    setSubmitting(false)
  }

  if (done) {
    return (
      <NoticeScreen
        title="Password changed"
        action={
          <TextLink href={backHref} block>
            {backLabel}
          </TextLink>
        }
      >
        Use your new password the next time you log in.
      </NoticeScreen>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-5">
      <p className="text-[16px] leading-[1.4] text-figma-muted">Enter the password you use now, then choose a new one.</p>

      {error && <ErrorBanner testId="form-error">{error}</ErrorBanner>}

      <Field
        label="Current password"
        type="password"
        placeholder="Current password"
        autoComplete="current-password"
        required
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value)
          setCurrentWrong(false)
        }}
        onBlur={() => setTouched((t) => ({ ...t, current: true }))}
        error={currentError}
      />
      <Field
        label="New password"
        type="password"
        placeholder="New password"
        autoComplete="new-password"
        required
        value={next}
        onChange={(e) => setNext(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, next: true }))}
        error={nextError}
      />
      <Field
        label="Confirm new password"
        type="password"
        placeholder="Confirm new password"
        autoComplete="new-password"
        required
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, again: true }))}
        error={againError}
      />

      <div className="min-h-4 flex-1" />
      <ActionButton type="submit" disabled={submitting} aria-busy={submitting || undefined} className="w-full">
        {submitting ? 'Saving…' : 'Save new password'}
      </ActionButton>
    </form>
  )
}
