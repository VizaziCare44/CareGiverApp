import { StatusChip } from '@/components/ui/status-chip'
import { bookingStatusLabel, type FamilyBookingStatus } from '@/lib/bookings/status-label'

// The status on a family booking (DEV-044). The three waiting states are the
// Figma chips: an amber clock pill while the booking waits for a caregiver or for
// the caregiver to be confirmed, a soft-green check pill once the caregiver is
// assigned. In progress, Completed and Cancelled stay plain text for now; the
// chips for those two come with DEV-078. The wrapper keeps the pill the width of
// its words (Figma's chip hugs its text) even inside a column that stretches.
export function BookingStatus({ status, caregiverVerified }: { status: FamilyBookingStatus; caregiverVerified: boolean | null }) {
  const { text, icon } = bookingStatusLabel(status, caregiverVerified)
  return (
    <div className="flex">
      {icon ? (
        <StatusChip status={icon === 'clock' ? 'awaiting' : 'assigned'} label={text} />
      ) : (
        <span className="text-[16px] font-semibold leading-[1.4] text-figma-ink">{text}</span>
      )}
    </div>
  )
}
