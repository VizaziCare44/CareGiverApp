// The words of the Admin's Exceptions screen (DEV-080; FD-ADMINEXC §7, frames EXC-01 to EXC-04b), in one
// place. Wording follows C1 to C3: nothing here says a visit or a person failed; "late" stays in E2 because it
// is the founder's 30-minute threshold and the line under it gives the number (C1, C4). A test scans these
// strings for the banned words (AC-011).
//
// "Last 7 days" and "from the last 7 days" are the DEC-4 figure written as copy (decision 15, AC-020): they
// are changed together with the window_days row of private.exception_settings (runbook addendum, part 5).

export const EXCEPTIONS_TEXT = {
  title: 'Exceptions',
  intro: 'Last 7 days. This list sends no alerts.',
  loaded: (time: string) => `Loaded ${time}`,
  loading: 'Loading…',
  loadingList: 'Loading exceptions…',
  notLoaded: 'Not loaded',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  openBooking: 'Open booking',
  emptyHeading: 'No exceptions from the last 7 days',
  emptyBody: 'None of the situations this screen looks for was found. It says nothing else about the visits.',
  error: "Couldn't load exceptions — check your connection and try again.",
  tryAgain: 'Try again',
  tryingAgain: 'Trying again…',
  columns: {
    visit: 'Date and time of the visit',
    recipient: 'Care recipient',
    caregiver: 'Caregiver',
    exceptions: 'Exceptions',
    action: 'Action',
  },
} as const

export type ExceptionKind = 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6'

/** The six labels (confirmed by Maya, §7) and their icons: person, clock, hourglass, empty box, shield, page. */
export const EXCEPTION_LABELS: Record<ExceptionKind, { label: string; icon: 'person' | 'clock' | 'hourglass' | 'box' | 'shield' | 'page' }> = {
  e1: { label: 'No check-in yet', icon: 'person' },
  e2: { label: 'Checked in late', icon: 'clock' },
  e3: { label: 'Still in progress', icon: 'hourglass' },
  e4: { label: 'Required task not done', icon: 'box' },
  e5: { label: 'Caregiver no longer Verified', icon: 'shield' },
  e6: { label: 'Visit record missing', icon: 'page' },
}

/** The detail lines of §7 ({span} is formatSpan, T5). */
export const EXCEPTION_DETAILS = {
  e1: (span: string) => `${span} after the requested time`,
  e2: (span: string) => `Checked in ${span} after the requested time`,
  e3: (span: string) => `Checked in ${span} ago. No check-out recorded.`,
  e4Reason: (reason: string) => `Reason: ${reason}`,
  e5: (name: string) => `${name} is not Verified now.`,
  e6: (status: string) => `Booking status is ${status}. No visit record found.`,
}

/** {status} is the shared status word. */
export const STATUS_WORD: Record<string, string> = { completed: 'Completed', in_progress: 'In progress', assigned: 'Assigned' }
