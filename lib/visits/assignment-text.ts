import { formatDate } from '@/lib/datetime'
import { BUNDLES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'

// The words on the Assignment Detail screen before and at check-in (DEV-064), as the copy table of
// FD-VISIT §6.5 gives them (checked against it on 2026-11-06, VIZ-91). Changing a word is an
// edit here and nowhere else.

export const CHECKLIST = {
  heading: 'Visit checklist',
  line: 'Required tasks must be logged before you can check out. Each booking is one visit.',
  required: 'Required',
  optional: 'Optional',
}

/** Under the Medication assistance task (§6.5; DECIDED 2026-10-13, §5.7(j), §6.6(a)). */
export const MEDICATION_ASSISTANCE_NOTES = {
  taskName: 'Medication assistance',
  description:
    'Help the recipient take the medicines they already have and are meant to take: put water in a cup, take the medicine out of its packet, and give both to them. You do not choose, change, add or stop any medicine or dose.',
  ifUnsure: 'If you are not sure about a medicine, do not give it. Log the task as Not done and say why.',
}

export const beforeTheDay = (visit: string | Date) => `Check-in opens on the day of the visit, ${formatDate(visit)}.`

export const anotherVisitInProgress = (name: string, bundle: BundleCode) =>
  `You already have a visit in progress (${name}, ${BUNDLES[bundle].name}). Check out of that visit first, then check in here.`

export const GO_TO_VISIT_IN_PROGRESS = 'Go to the visit in progress'

/** The sentence ends here; the address follows on its own row, then the full stop (DECIDED 2026-10-16, §6.6(m)). */
export const DAY_PASSED = 'The day of this visit has passed, so check-in is no longer offered. If you attended this visit, contact Vizazi Care at'

export const CHECK_IN_DIALOG = {
  title: 'Check in to this visit?',
  /** "[Name] · [bundle] · [date]": the bundle name only, no length; the date alone, no clock time (§6.6(k)(c), (j)). */
  detail: (recipient: string, bundleName: string, date: string) => `${recipient} · ${bundleName} · ${date}`,
  body: 'The family will see this visit as "In progress". The check-in time is recorded when you confirm.',
  confirm: 'Check in',
  cancel: 'Cancel',
}

export const checkedInLine = (time: string) => `Checked in: ${time}`

// In progress (DEV-065; frames VIS-06, VIS-06b, VIS-06c), §6.5.
export const TASKS = {
  heading: 'Tasks',
  progress: (logged: number, total: number) => `Required tasks logged: ${logged} of ${total}. Tap a task to log it.`,
  states: { none: 'Not logged yet', done: 'Done', not_done: 'Not done' },
}

export const IN_PROGRESS_LABEL = 'In progress'

export const CHECK_OUT = {
  button: 'Check out',
  blocked: (names: string[]) =>
    `Check out is available once every Required task is logged as Done, or as Not done with a reason. Still to log: ${names.join(', ')}.`,
  ready: 'All Required tasks are logged.',
  readyWithOptional: (name: string) => `All Required tasks are logged. ${name} is Optional, so you can check out without it.`,
}
