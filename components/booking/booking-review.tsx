'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import { BUNDLES } from '@/lib/bookings/bundles'
import { BookingStepHeader } from './booking-step-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { submitBooking } from '@/app/book/review/actions'

// FR-006 / AC-003 / TC-ACC-006, 007, 014.
export function BookingReview() {
  const router = useRouter()
  const draft = useBookingDraft()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // synchronous guard against a double-tap landing before React re-renders
  // the disabled button — the only real safeguard against a duplicate
  // booking, since no slot-locking exists (§6.5).
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!draft.bundleCode || !draft.date || !draft.time) router.replace('/book/bundle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.bundleCode, draft.date, draft.time])

  if (!draft.bundleCode || !draft.date || !draft.time || !draft.recipientId) return null
  const bundle = BUNDLES[draft.bundleCode]

  async function handleSubmit() {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)

    let result: { error?: string; bookingId?: string }
    try {
      result = await submitBooking({
        careRecipientId: draft.recipientId!,
        bundleCode: draft.bundleCode!,
        requestedDatetime: new Date(`${draft.date}T${draft.time}`).toISOString(),
      })
    } catch {
      // A genuine connection failure (not a Supabase-level error, which
      // submitBooking already returns as { error }) rejects this Server
      // Action call instead of resolving it — without this catch, the UI
      // was left stuck on "Submitting…" forever with no way to retry
      // (TC-ACC-014 / NFR §4.2).
      result = { error: "Couldn't submit — check your connection and try again." }
    }

    if (result.error) {
      setError(result.error)
      submittingRef.current = false
      setSubmitting(false)
      return
    }

    // Don't clear the draft here: it's a state update on this still-mounted
    // component, and its own useEffect above watches bundleCode/date/time —
    // clearing them before the navigation completes made that effect fire
    // first and redirect back to /book/bundle, stealing the push below.
    // Confirmed live: the booking row was created correctly, but the FM was
    // bounced back to Bundle Selection instead of seeing Confirmation.
    // The confirmation page clears the draft itself once safely mounted.
    router.push('/book/confirmation')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <BookingStepHeader title="Review your booking" />

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Care recipient</p>
            <p className="text-lg text-foreground">{draft.recipientName}</p>
          </div>
          <Link href="/recipients" className="text-base font-medium text-sage-700 underline">
            Edit
          </Link>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <p className="text-sm text-muted-foreground">Bundle</p>
            <p className="text-lg text-foreground">{bundle.name}</p>
          </div>
          <Link href="/book/bundle" className="text-base font-medium text-sage-700 underline">
            Edit
          </Link>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <p className="text-sm text-muted-foreground">Date &amp; time</p>
            <p className="text-lg text-foreground">
              {draft.date} at {draft.time}
            </p>
          </div>
          <Link href="/book/datetime" className="text-base font-medium text-sage-700 underline">
            Edit
          </Link>
        </div>
      </Card>

      {error && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="flex items-center gap-1.5 text-sm status-error">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
          <Button onClick={handleSubmit} className="w-full">
            Retry
          </Button>
        </div>
      )}

      {!error && (
        <Button onClick={handleSubmit} loading={submitting} className="w-full" data-testid="submit-booking">
          Submit
        </Button>
      )}
    </main>
  )
}
