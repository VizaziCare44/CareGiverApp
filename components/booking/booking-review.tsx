'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import { formatDateTime, slotToInstant } from '@/lib/datetime'
import { ActionButton } from '@/components/ui/action-button'
import { BookingScreen } from './booking-screen'
import { BookingSummary } from './booking-summary'
import { submitBooking } from '@/app/book/review/actions'

// FR-006 / AC-003 / TC-ACC-006, 007, 014, frames ACC-09, 09b (Submitting…, the button disabled so it
// cannot be sent twice) and 09c (the error banner, the data kept, Submit available again).
export const SUBMIT_ERROR = "Couldn't submit — check your connection and try again"

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
        requestedDatetime: slotToInstant(draft.date!, draft.time!),
      })
    } catch {
      // A genuine connection failure (not a Supabase-level error, which
      // submitBooking already returns as { error }) rejects this Server
      // Action call instead of resolving it — without this catch, the UI
      // was left stuck on "Submitting…" forever with no way to retry
      // (TC-ACC-014 / NFR §4.2).
      result = { error: SUBMIT_ERROR }
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
    <BookingScreen heading="Review your booking request">
      <BookingSummary
        rows={[
          { label: 'Care recipient', value: draft.recipientName, edit: { href: '/recipients', label: 'Edit care recipient' } },
          { label: 'Care bundle', value: BUNDLE_LINES[draft.bundleCode], edit: { href: '/book/bundle', label: 'Edit care bundle' } },
          { label: 'Date and time of the visit', value: formatDateTime(slotToInstant(draft.date, draft.time)), edit: { href: '/book/datetime', label: 'Edit date and time' } },
        ]}
      />

      <p className="text-[15px] leading-[1.4] text-figma-muted">This is a request for one visit. We&apos;ll confirm your caregiver after you submit.</p>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-[10px] border border-figma-danger bg-figma-dangersoft p-3" data-testid="submit-error">
          <svg aria-hidden="true" className="shrink-0 text-figma-danger" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.5l9.5 16.5h-19L12 3.5z" />
            <path d="M12 10v4.5M12 17.4v.1" />
          </svg>
          <p className="min-w-0 flex-1 text-[15px] font-medium leading-[1.4] text-figma-danger">{error}</p>
        </div>
      )}

      <div className="flex-1" />
      <ActionButton onClick={handleSubmit} disabled={submitting} aria-busy={submitting || undefined} className="w-full" data-testid="submit-booking">
        {submitting ? 'Submitting…' : 'Submit'}
      </ActionButton>
    </BookingScreen>
  )
}
