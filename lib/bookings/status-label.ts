// How a booking's state reads to the family (FD-VERIFY §6, FR-017, AC-019), one
// place for My Bookings (DEV-044) and Booking Detail (DEV-045). Drafted from the
// ticket text; frames VER-09 and 09b were not available to read.
//
// The family sees three states while a booking is waiting, and the third one is
// the case where the caregiver is no longer Verified: the family is told their
// caregiver is being confirmed, never that the caregiver lost Verified (the name
// is withheld by family_bookings in that case, see migration 0010).
// The icon says the same thing as the words, so state is never colour alone.
// In progress, Completed and Cancelled are plain text.

export type FamilyBookingStatus = 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'

export interface BookingStatusLabel {
  text: string
  /** 'clock' and 'check' draw an icon beside the words; null is plain text. */
  icon: 'clock' | 'check' | null
}

export function bookingStatusLabel(status: FamilyBookingStatus, caregiverVerified: boolean | null): BookingStatusLabel {
  switch (status) {
    case 'requested':
      return { text: 'Awaiting caregiver assignment', icon: 'clock' }
    case 'assigned':
      return caregiverVerified === false
        ? { text: 'Confirming your caregiver', icon: 'clock' }
        : { text: 'Caregiver assigned', icon: 'check' }
    case 'in_progress':
      return { text: 'In progress', icon: null }
    case 'completed':
      return { text: 'Completed', icon: null }
    case 'cancelled':
      return { text: 'Cancelled', icon: null }
  }
}
