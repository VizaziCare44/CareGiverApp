// The caregiver block on the family's Booking Detail (DEV-045; FD-VERIFY §6.1
// Flow E, FR-011, FR-012, AC-011, AC-012). One place for the rule that picks the
// state and for the words in it. Drafted from the ticket text; frames VER-10 to
// VER-10d and the Flow E table were not available to read.
//
// family_bookings supplies the name (null when it must not be shown) and
// caregiver_verified; the booking status completes the picture:
//
//   requested, no caregiver              -> 'assigning'   (state 1)
//   assigned, caregiver Verified         -> 'verified'    (state 2)
//   assigned, caregiver not Verified     -> 'confirming'  (state 3: no name, no badge, no explanation)
//   in progress or completed, Verified   -> 'verified'    (state 2)
//   in progress or completed, not Verified -> 'started-unverified' (state 4: the name only)
//   cancelled, or anything that does not fit -> null (no block)
//
// The view already withholds the name in state 3, so this screen could not show it
// even by mistake.

import type { FamilyBookingStatus } from './status-label'

export type CaregiverBlockState = 'assigning' | 'verified' | 'confirming' | 'started-unverified'

export function caregiverBlockState(
  status: FamilyBookingStatus,
  caregiverName: string | null,
  caregiverVerified: boolean | null,
): CaregiverBlockState | null {
  if (status === 'requested') return 'assigning'
  if (status === 'assigned') return caregiverVerified === true && caregiverName ? 'verified' : 'confirming'
  if (status === 'in_progress' || status === 'completed') {
    if (!caregiverName) return null
    return caregiverVerified === true ? 'verified' : 'started-unverified'
  }
  return null
}

export const CAREGIVER_BLOCK_TEXT = {
  heading: 'Your caregiver',
  assigning: "We're assigning a caregiver…",
  confirming: 'Vizazi Care is confirming your caregiver for this visit.',
  // PLACEHOLDER. FD-VERIFY §5.7(k) has a founder-confirmed sentence that goes here
  // word for word, directly under the Verified pill. It is not in the ticket or in
  // Linear, so this stands in until it is supplied; replacing this one string
  // updates the screen and its tests.
  verifiedSentence: '[Founder-confirmed sentence from FD-VERIFY §5.7(k) to be supplied]',
} as const
