import { ActionLink } from '@/components/ui/action-button'
import { ContactEmailLink } from '@/components/caregiver/missing-booking-help'

/**
 * The one message for a booking that is not (or no longer) the Caregiver's to see: reassigned,
 * the Caregiver no longer Verified, someone else's, or made up (BR-007, AC-021). No reason, and
 * nothing of the booking or its notes. Used by Assignment Detail and by Log task.
 */
export function BookingUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-6 py-10 text-figma-ink">
      <h1 className="text-[28px] font-bold leading-9">This booking is no longer available to you.</h1>
      <p className="text-[16px] leading-[1.4]">
        Its details and care notes are no longer shown. If you weren&apos;t expecting this, contact Vizazi Care at <ContactEmailLink />.
      </p>
      <ActionLink href="/assignments" variant="secondary" className="self-start">
        Back to my assignments
      </ActionLink>
    </main>
  )
}
