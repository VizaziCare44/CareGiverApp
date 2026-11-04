import { formatDate } from '@/lib/datetime'
import { BUNDLES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'

// The words on the Assignment Detail screen before and at check-in (DEV-064). The lines the
// ticket gives verbatim are exact. The two Medication assistance lines, the check-in dialog's
// detail and body lines come from FD-VISIT §6.5, which was not available: they are DRAFT.
// Changing a word is an edit here and nowhere else.

export const CHECKLIST = {
  heading: 'Visit checklist',
  line: 'Required tasks must be logged before you can check out. Each booking is one visit.',
  required: 'Required',
  optional: 'Optional',
}

/** Under the Medication assistance task. DRAFT (FD-VISIT §6.5 verbatim text not available). */
export const MEDICATION_ASSISTANCE_NOTES = {
  taskName: 'Medication assistance',
  description: 'Help the care recipient take the medicines they have been prescribed, at the right times.',
  ifUnsure: 'If you are unsure about a medicine or a dose, do not guess: contact Vizazi Care before the care recipient takes it.',
}

export const beforeTheDay = (visit: string | Date) => `Check-in opens on the day of the visit, ${formatDate(visit)}.`

export const anotherVisitInProgress = (name: string, bundle: BundleCode) =>
  `You already have a visit in progress (${name}, ${BUNDLES[bundle].name}). Check out of that visit first, then check in here.`

export const GO_TO_VISIT_IN_PROGRESS = 'Go to the visit in progress'

/** The sentence ends here; the address follows on its own row, then the full stop (DECIDED 2026-10-16, §6.6(m)). */
export const DAY_PASSED = 'The day of this visit has passed, so check-in is no longer offered. If you attended this visit, contact Vizazi Care at'

export const CHECK_IN_DIALOG = {
  title: 'Check in to this visit?',
  /** DRAFT */
  detail: (recipient: string, bundleLine: string) => `${recipient} · ${bundleLine}`,
  /** DRAFT */
  body: 'Your check-in time is recorded when you confirm. Each booking is one visit.',
  confirm: 'Check in',
  cancel: 'Cancel',
}

export const checkedInLine = (time: string) => `Checked in: ${time}`
