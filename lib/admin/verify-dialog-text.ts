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

// Text of the Remove Verified dialog (DEV-039). A DRAFT, like the above: the
// wording of frame VER-04 and the three paragraphs of FD-VERIFY §6.1 Flow B were
// not available. The substance is fixed by the ticket and by what the system
// does (the caregiver loses their bookings and care notes at once, even during a
// visit, and the app does not tell them; families see the name only for a visit
// that has started or finished); the sentences are mine.
export const REMOVE_DIALOG = {
  title: (name: string) => `Remove Verified status from ${name}`,
  consequences: [
    (name: string) =>
      `${name} loses access to their assigned bookings and to the care notes at once, even during a visit. The app does not tell them.`,
    (name: string) =>
      `Bookings assigned to ${name} that have not started will be listed under "Bookings that need a new caregiver" on this page. You will need to reassign each one.`,
    () =>
      'Families with a visit that has not started will see that Vizazi Care is confirming their caregiver, without the name. Families whose visit has started or finished will still see the caregiver\'s name.',
  ],
  noteLabel: 'Why are you removing Verified status?',
  noteHelper:
    'Write the reason. Do not type ID numbers or other identity document details here. It is kept in the history with your name and the time.',
  submit: 'Remove Verified status',
  cancel: 'Cancel',
  close: 'Close',
  done: (name: string) => `${name} is no longer Verified.`,
} as const

/** "Still needed: write the reason." or null once the reason is written. */
export function removeHint(note: string) {
  return note.trim() === '' ? 'Still needed: write the reason.' : null
}
