// The words on the check-out confirmation (VIS-08) and the visit summary (VIS-09), DEV-067, as the
// copy table of FD-VISIT §6.5 gives them (checked against it on 2026-11-06, VIZ-91).

export const VISIT_NOTE_LIMIT = 2000

export const CHECK_OUT_DIALOG = {
  title: 'Check out of this visit?',
  body: `After you check out you can't change the tasks or notes. The family will see this visit as "Completed" and can read the tasks, reasons and notes you recorded.`,
  optionalNotRecorded: (name: string) => `${name} is Optional and has no outcome. It will show as "Not recorded".`,
  noteLabel: 'Note about the visit (optional)',
  confirm: 'Check out',
  back: 'Go back',
  tooLong: 'This is too long. The limit is 2,000 characters.',
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
  note: (text: string) => `Note: ${text}`,
  /** The summary's row, "Visit note" (§6.5); the confirmation's field is "Note about the visit (optional)". */
  visitNote: 'Visit note',
  back: 'Back to my assignments',
}
