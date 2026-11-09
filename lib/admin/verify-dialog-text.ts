// Text of the Mark as Verified dialog (DEV-038), as frames VER-03, 03b and 03c of "FD-VERIFY screens" word it.
// Changing the text is an edit here and nowhere else.

export const VERIFY_DIALOG = {
  title: 'Mark as Verified',
  intro: (name: string) => `Record the result of the ID check and review you did outside the app. ${name} will be offered for new bookings once you save.`,
  confirmations: ["I have checked this caregiver's identity", 'I have reviewed this caregiver'],
  noteLabel: 'What did you check? (required)',
  notePlaceholder: 'For example: what you checked, and that a background check was done and its outcome',
  warning: 'Do not type ID numbers or copy the contents of any document or record. Write only what you checked and the outcome.',
  submit: 'Mark as Verified',
  cancel: 'Cancel',
  close: 'Close',
  done: (name: string) => `${name} is now Verified.`,
} as const

export const NOTE_MAX_LENGTH = 1000

/** What is still missing before the button works, in the order on screen. */
export function missingForVerify(state: { first: boolean; second: boolean; note: string }) {
  const missing: string[] = []
  if (!state.first) missing.push('first')
  if (!state.second) missing.push('second')
  if (state.note.trim() === '') missing.push('note')
  return missing
}

/** "To continue: tick both boxes and write what you checked." or null when nothing is missing. */
export function verifyHint(missing: string[]) {
  if (missing.length === 0) return null
  const boxes = missing.filter((item) => item !== 'note').length
  const parts: string[] = []
  if (boxes === 2) parts.push('tick both boxes')
  else if (boxes === 1) parts.push('tick the other box')
  if (missing.includes('note')) parts.push('write what you checked')
  return `To continue: ${parts.join(' and ')}.`
}

// Text of the Remove Verified status dialog (DEV-039), as frame VER-04 words it. The three paragraphs say what the
// caregiver, the booking and the family will see; the reason is required.
export const REMOVE_DIALOG = {
  title: 'Remove Verified status',
  consequences: [
    (name: string) => `${name} will no longer be offered for new bookings.`,
    () => 'The caregiver will stop seeing their assigned bookings and care notes at once, even during a visit. The app does not tell them, so please tell them yourself.',
    () =>
      'Families with a booking that has not started will see "Vizazi Care is confirming your caregiver for this visit." until you assign someone else. Families with a visit that has started or finished will keep seeing the caregiver\'s name, without the Verified badge.',
  ],
  noteLabel: 'Reason (required)',
  notePlaceholder: 'Why are you removing Verified status?',
  submit: 'Remove Verified status',
  cancel: 'Cancel',
  close: 'Close',
  done: (name: string) => `${name} is no longer Verified.`,
} as const
