import type { BundleCode } from './types'

/**
 * Bundle content per FD-ACC §6.6(a). Only these two bundles exist this Beta
 * (BR-001) — Full Circle / Peace of Mind are not modeled anywhere in this
 * codebase, not just hidden in the UI.
 *
 * Deliberately no `price` field: BR-005 says pricing is not shown anywhere
 * in-app this Beta. Omitting the field (rather than storing it and hiding
 * it in the UI) makes a future screen accidentally rendering a price
 * impossible, not just unlikely.
 */
export interface BundleContent {
  code: BundleCode
  name: string
  durationLabel: string
  frequencyLabel: string
  inclusions: string[]
  sla: string[]
  reportName: string
  dateTimeCopy: string
}

export const BUNDLES: Record<BundleCode, BundleContent> = {
  medicheck: {
    code: 'medicheck',
    name: 'MediCheck',
    durationLabel: '3-hour visit',
    frequencyLabel: 'Daily',
    inclusions: ['Medication administration', 'Vitals check (blood pressure, glucose)', 'Companionship'],
    sla: ['Emergency response under 30 minutes', 'Missed-medication alert under 15 minutes'],
    reportName: 'MediCheck Report',
    dateTimeCopy: 'Select the daily visit time',
  },
  doctors_day_out: {
    code: 'doctors_day_out',
    name: "Doctor's Day Out",
    durationLabel: '4–5 hour appointment day',
    frequencyLabel: 'Single booking',
    inclusions: ['Pre-visit preparation', 'Transport & escort', 'Advocacy and note-taking', 'Post-visit report'],
    sla: ['Emergency response under 15 minutes', 'Dedicated hotline'],
    reportName: 'Clinic Visit Report',
    dateTimeCopy: 'Select the appointment day and time',
  },
}

export const BUNDLE_LIST = Object.values(BUNDLES)

/**
 * The bundle line shown on the Caregiver's screens (FD-ACC §6.7; FD-VISIT
 * §6.6(k)(c)): exactly these two strings, with no hyphen before "hour" in the
 * second. One constant, so My Assignments (DEV-047), Assignment Detail (DEV-048)
 * and the FD-VISIT screens (DEV-063) cannot drift apart.
 */
export const BUNDLE_LINES: Record<BundleCode, string> = {
  medicheck: 'MediCheck · 3-hour visit',
  doctors_day_out: "Doctor's Day Out · 4–5 hour visit",
}
