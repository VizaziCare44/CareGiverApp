'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import { LeaveWithoutFinishingModal } from './leave-without-finishing-modal'

/**
 * Back/Cancel header shared by every step from Bundle Selection onward.
 * This component is only ever rendered on those screens (bundle/datetime/
 * review) — its mere presence *is* "at Bundle Selection or a later step"
 * (AC-006), so Back always triggers the modal here. Earlier steps (Sign Up,
 * Care Recipient List, Add Care Recipient, Who-is-this-for) don't render
 * this header at all and exit normally with no modal (TC-ACC-013 boundary).
 */
export function BookingStepHeader({ title, exitTo = '/recipients' }: { title: string; exitTo?: string }) {
  const router = useRouter()
  const draft = useBookingDraft()
  const [modalOpen, setModalOpen] = useState(false)

  function handleBack() {
    setModalOpen(true)
  }

  function handleLeave() {
    draft.clear()
    setModalOpen(false)
    router.push(exitTo)
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          data-testid="booking-back"
          className="flex min-h-touch min-w-touch items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-500"
        >
          <span aria-hidden="true" className="text-xl">
            ←
          </span>
        </button>
        <h1 className="text-2xl text-foreground">{title}</h1>
      </div>
      <LeaveWithoutFinishingModal open={modalOpen} onStay={() => setModalOpen(false)} onLeave={handleLeave} />
    </>
  )
}
