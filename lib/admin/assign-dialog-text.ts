// Text of the Assign and Change caregiver confirmation dialogs and the banner
// that follows (DEV-043). A DRAFT: the wording of frames VER-08, 08b, 08c, 08d
// and the consequence text of FD-VERIFY §6.1 Flows C and D were not available.
// What is fixed is what the ticket asks for (the reminder that the family is not
// notified automatically) and what the system really does: the caregiver gains
// (or loses) the booking and the care notes at once, and the family sees the
// caregiver's name once the booking is assigned to a Verified caregiver.
// Changing the text is an edit here and nowhere else.

export type AssignMode = 'assign' | 'change'

export const FAMILY_NOT_NOTIFIED = 'The family is not notified automatically. Tell them yourself if they should know.'

export const ASSIGN_DIALOG = {
  assign: {
    title: (caregiver: string) => `Assign ${caregiver} to this booking`,
    consequences: (caregiver: string, recipient: string) => [
      `${caregiver} will see this booking, and the care notes for ${recipient}, in their assignments.`,
      'The family will see who their caregiver is when they open the booking.',
      FAMILY_NOT_NOTIFIED,
    ],
    submit: 'Assign caregiver',
    banner: 'Caregiver assigned.',
  },
  change: {
    title: (caregiver: string) => `Change the caregiver to ${caregiver}`,
    consequences: (caregiver: string, recipient: string, previous: string) => [
      `${previous} loses access to this booking and to the care notes for ${recipient} at once.`,
      `${caregiver} will see this booking, and the care notes, in their assignments.`,
      `The family will see the new caregiver the next time they open the booking. ${FAMILY_NOT_NOTIFIED}`,
    ],
    submit: 'Change caregiver',
    banner: 'Caregiver changed.',
  },
  cancel: 'Cancel',
  close: 'Close',
} as const

/** The banner on Booking Detail after a successful assignment; null for anything else in the URL. */
export function bannerText(value: string | undefined) {
  if (value === 'assigned') return ASSIGN_DIALOG.assign.banner
  if (value === 'changed') return ASSIGN_DIALOG.change.banner
  return null
}
