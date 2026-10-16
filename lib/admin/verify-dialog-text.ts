// Text of the Mark as Verified dialog (DEV-038). A DRAFT: the wording of frames
// VER-03, 03b and 03c (FD-VERIFY §6.1) was not available when this was written,
// so only what the ticket quotes is fixed: the note label "What did you check?",
// the warning not to type ID numbers, and the button name. Changing the text is
// an edit here and nowhere else.

export const VERIFY_DIALOG = {
  title: (name: string) => `Mark ${name} as Verified`,
  intro: (name: string) =>
    `Once Verified, ${name} can be assigned to bookings and will see the booking details and care notes for the visits assigned to them.`,
  confirmations: [
    (name: string) => `I have met ${name} in person and checked who they are.`,
    () => 'I have checked their references.',
  ],
  noteLabel: 'What did you check?',
  noteHelper:
    'Describe what you checked. Do not type ID numbers or other identity document details here. The note is kept in the history with your name and the time.',
  submit: 'Mark as Verified',
  cancel: 'Cancel',
  close: 'Close',
  done: (name: string) => `${name} is now Verified.`,
} as const

export const NOTE_MAX_LENGTH = 1000

/** What is still missing before the button works, in the order on screen. */
export function missingForVerify(state: { first: boolean; second: boolean; note: string }) {
  const missing: string[] = []
  if (!state.first) missing.push('tick the first box')
  if (!state.second) missing.push('tick the second box')
  if (state.note.trim() === '') missing.push('write what you checked')
  return missing
}

/** "Still needed: tick the first box, write what you checked." or null when nothing is. */
export function verifyHint(missing: string[]) {
  return missing.length === 0 ? null : `Still needed: ${missing.join(', ')}.`
}
