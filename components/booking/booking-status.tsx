import { StatusChip } from '@/components/ui/status-chip'
import { bookingStatusLabel, type FamilyBookingStatus } from '@/lib/bookings/status-label'

// The status on a family booking (DEV-044, DEV-078). The Figma chips: an amber clock pill while the
// booking waits for a caregiver or for the caregiver to be confirmed, and for a visit in progress; a
// soft-green check pill once the caregiver is assigned, and for a completed visit. In progress and
// Completed are the same two chips as on the Caregiver's screens (one shared component), text plus an
// icon and never colour alone. Cancelled stays plain text. The wrapper keeps the pill the width of its
// words (Figma's chip hugs its text) even inside a column that stretches.
export function BookingStatus({ status, caregiverVerified }: { status: FamilyBookingStatus; caregiverVerified: boolean | null }) {
  const { text, icon } = bookingStatusLabel(status, caregiverVerified)
  return (
    <div className="flex">
      {icon ? (
        <StatusChip status={status === 'in_progress' ? 'in-progress' : status === 'completed' ? 'completed' : icon === 'clock' ? 'awaiting' : 'assigned'} label={text} />
      ) : (
        <span className="text-[16px] font-semibold leading-[1.4] text-figma-ink">{text}</span>
      )}
    </div>
  )
}
