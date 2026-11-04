// The words on the check-out confirmation (VIS-08) and the visit summary (VIS-09), DEV-067. The
// lines the ticket gives are exact (founder-confirmed 2026-10-16). The labels and messages marked
// DRAFT come from FD-VISIT §6.5, which was not available.

export const VISIT_NOTE_LIMIT = 2000

export const CHECK_OUT_DIALOG = {
  title: 'Check out of this visit?',
  body: `After you check out you can't change the tasks or notes. The family will see this visit as "Completed" and can read the tasks, reasons and notes you recorded.`,
  optionalNotRecorded: (name: string) => `${name} is Optional and has no outcome. It will show as "Not recorded".`,
  noteLabel: 'Note about the visit (optional)',
  confirm: 'Check out',
  back: 'Go back',
  pending: 'Checking out…',
  /** DRAFT */
  tooLong: 'This is too long. The limit is 2,000 characters. Shorten it to check out.',
  /** DRAFT */
  notCheckedOut: "Not checked out. Check your connection and try again. What you typed is still here.",
  /** DRAFT */
  unknownError: 'Not checked out. Something went wrong. Try again. What you typed is still here.',
}

export const SUMMARY = {
  title: 'Visit summary',
  intro: 'This is what you recorded. The family can now read the tasks, reasons and notes. The times were set by the app.',
  careRecipient: 'Care recipient',
  bundle: 'Bundle',
  checkedIn: 'Checked in',
  checkedOut: 'Checked out',
  tasks: 'Tasks',
  done: 'Done',
  notDone: 'Not done',
  notRecorded: 'Not recorded',
  reason: (text: string) => `Reason: ${text}`,
  /** DRAFT */
  note: (text: string) => `Note: ${text}`,
  /** DRAFT */
  visitNote: 'Note about the visit',
  back: 'Back to my assignments',
}
