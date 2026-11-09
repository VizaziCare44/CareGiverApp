// Text of the Assign and Change caregiver confirmation dialogs and the banner
// that follows (DEV-043), as frames VER-08 and VER-08b of "FD-VERIFY screens" word them. The frames do not
// carry the "family is not notified automatically" reminder in the Assign dialog; the Change dialog has it.
// Changing the text is an edit here and nowhere else.

export type AssignMode = 'assign' | 'change'

export const ASSIGN_DIALOG = {
  assign: {
    title: 'Assign caregiver',
    // the line under the summary: who will see what, and what the family sees
    body: (caregiver: string, recipient: string) =>
      `${caregiver} will see this booking and ${recipient}'s care notes. The family will see ${caregiver}'s name and Verified badge when they next open the app.`,
    submit: 'Assign',
    banner: 'Caregiver assigned.',
  },
  change: {
    title: 'Change caregiver',
    body: (caregiver: string, previous: string) =>
      `${caregiver} will see this booking and the care notes. ${previous} will lose access to this booking and the care notes. The family is not notified automatically — they will see the change when they next open the app.`,
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
