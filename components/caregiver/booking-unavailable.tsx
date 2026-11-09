import { AppBar } from '@/components/ui/app-bar'
import { TextLink } from '@/components/ui/text-link'
import { ContactEmailLink } from '@/components/caregiver/missing-booking-help'

/**
 * The one message for a booking that is not (or no longer) the Caregiver's to see: reassigned,
 * the Caregiver no longer Verified, someone else's, or made up (BR-007, AC-021). No reason, and
 * nothing of the booking or its notes. Used by Assignment Detail and by Log task. Frame VER-12b: the app bar,
 * a note with the circled "i", and the way back as a text link.
 */
export function BookingUnavailable() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-white text-figma-ink">
      <AppBar title="Assignment" backHref="/assignments" backLabel="Back to my assignments" />
      <main className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-2 rounded-[14px] bg-figma-surface p-4">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 shrink-0">
            <circle cx="10" cy="10" r="8.5" />
            <path d="M10 9v5M10 6v.1" />
          </svg>
          <div className="flex min-w-0 flex-1 flex-col text-[16px] leading-[1.4]">
            <h1 className="font-semibold">This booking is no longer available to you.</h1>
            <p>
              Its details and care notes are no longer shown. If you weren&apos;t expecting this, contact Vizazi Care at <ContactEmailLink />.
            </p>
          </div>
        </div>
        <TextLink href="/assignments" className="self-start">
          Back to my assignments
        </TextLink>
      </main>
    </div>
  )
}
