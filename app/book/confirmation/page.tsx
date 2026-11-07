'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import { formatDateTime, slotToInstant } from '@/lib/datetime'
import { BookingSummary } from '@/components/booking/booking-summary'
import type { BundleCode } from '@/lib/bookings/types'

interface Received {
  recipient: string
  bundle: BundleCode
  visit: string
}

// FR-006, frame ACC-10. "Request received." with a check in a soft circle, the line "We'll confirm your caregiver
// soon.", the booking summary without Edit links, and the link "View my bookings" (added by FD-VERIFY, FR-017):
// no app bar and no other button. No per-visit detail is promised here yet (that's FD-VERIFY/FD-VISIT's territory
// once a caregiver is assigned).
export default function ConfirmationPage() {
  const draft = useBookingDraft()
  const [received, setReceived] = useState<Received | null>(null)

  // The summary is taken from the draft once, then the draft is cleared. Clearing here (once this page is
  // safely mounted) rather than in BookingReview before navigating — see booking-review.tsx's handleSubmit
  // for why clearing pre-navigation raced with this page's own arrival.
  useEffect(() => {
    if (draft.recipientName && draft.bundleCode && draft.date && draft.time) {
      setReceived({ recipient: draft.recipientName, bundle: draft.bundleCode, visit: slotToInstant(draft.date, draft.time) })
    }
    draft.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center gap-4 bg-white p-5 text-figma-ink">
      <div className="flex size-[72px] items-center justify-center rounded-full bg-figma-soft text-figma-primary" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <h1 className="text-center text-[24px] font-bold leading-[1.25]">Request received.</h1>
      <p className="text-center text-[18px] leading-[1.4]">We&apos;ll confirm your caregiver soon.</p>
      {received && (
        <BookingSummary
          rows={[
            { label: 'Care recipient', value: received.recipient },
            { label: 'Care bundle', value: BUNDLE_LINES[received.bundle] },
            { label: 'Date and time of the visit', value: formatDateTime(received.visit) },
          ]}
        />
      )}
      {/* DEV-046: the way into My Bookings */}
      <Link
        href="/bookings"
        className="flex h-11 w-full items-center justify-center rounded-lg text-[16px] font-semibold leading-[1.4] text-figma-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary"
      >
        View my bookings
      </Link>
    </main>
  )
}
