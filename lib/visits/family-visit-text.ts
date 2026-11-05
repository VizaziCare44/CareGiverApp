// The words of the visit block on the family's Booking Detail (DEV-075; frames FAM-02, FAM-07;
// FD-FAMVIS §6.1). The lines the ticket gives are exact. The words are "checked in" and "checked
// out" and never "arrived", "left" or "on site", and there is no location or map (FR-010): a test
// scans this file for them. Times are never written here; they come from the shared formatter
// (lib/datetime.ts).

export const FAMILY_VISIT = {
  heading: 'Visit',
  checkedInAt: 'Checked in at',
  /** F2: the visit is in progress */
  inProgressLine: 'Tasks and notes appear here after your caregiver checks out. Open this page again to see them.',
  /** F4: completed, and there is no visit row at all. The address follows on its own row. */
  notAvailable: 'The visit report is not available. Please contact Vizazi Care at',
  /** F5: a read failed, or the visit is not in a state a report can be made from */
  loadError: "Couldn't load the visit report — check your connection and try again.",
  tryAgain: 'Try again',
  trying: 'Trying again…',
} as const

// The words of the visit report (DEV-076; frames FAM-03 to FAM-06; FD-FAMVIS §6.1, §6.5). The lines the
// ticket gives are exact. Quality gate (a test): none of "arrived", "left", "on site", "failed", "missed",
// "incomplete" or "problem" appears in these strings, and neither "Required" nor "Optional".
export const FAMILY_REPORT = {
  checkedOutAt: 'Checked out at',
  recordedBy: 'This is what your caregiver recorded during the visit. Vizazi Care does not check or interpret it.',
  loggedAt: (time: string) => `Logged at ${time}`,
  reason: 'Reason:',
  note: 'Note:',
  visitNoteHeading: 'Note about the visit',
} as const
