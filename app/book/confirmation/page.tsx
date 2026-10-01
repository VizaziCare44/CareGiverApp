'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useBookingDraft } from '@/lib/bookings/draft-context'

// FR-006. Generic confirmation — no per-visit detail is promised here yet
// (that's FD-VERIFY/FD-VISIT's territory once a caregiver is assigned).
export default function ConfirmationPage() {
  const draft = useBookingDraft()

  // Clearing here (once this page is safely mounted) rather than in
  // BookingReview before navigating — see booking-review.tsx's handleSubmit
  // for why clearing pre-navigation raced with this page's own arrival.
  useEffect(() => {
    draft.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-100 text-3xl" aria-hidden="true">
        ✓
      </div>
      <h1 className="text-2xl text-foreground">Request received</h1>
      <p className="text-lg text-muted-foreground">We&apos;ll confirm your caregiver soon.</p>
      <Link href="/recipients" className="w-full">
        <Button className="w-full">Done</Button>
      </Link>
    </main>
  )
}
