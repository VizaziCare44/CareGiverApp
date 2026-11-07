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
  /** The line under the name on the Bundle Selection card (Figma ACC-07). */
  summary: string
  inclusions: string[]
  /** The Response times text on the card, one paragraph. */
  responseTimes: string
  reportName: string
}

export const BUNDLES: Record<BundleCode, BundleContent> = {
  medicheck: {
    code: 'medicheck',
    name: 'MediCheck',
    summary: '3-hour visit at home',
    // DEV-058: exactly these four, in this order (FD-VISIT §5.7(j), §6.6(b); Figma ACC-07 and ACC-11).
    inclusions: ['Medication assistance', 'Vitals check (blood pressure and glucose)', 'Companionship', 'MediCheck Report in the app'],
    responseTimes: 'Emergency response: under 30 minutes. Missed-medication alert: under 15 minutes.',
    reportName: 'MediCheck Report',
  },
  doctors_day_out: {
    code: 'doctors_day_out',
    name: "Doctor's Day Out",
    summary: '4–5 hour visit on the day of a medical appointment',
    inclusions: ['Pre-visit preparation', 'Transport and escort', 'Advocacy and note-taking', 'Post-visit Clinic Visit Report in the app'],
    responseTimes: 'Emergency response: under 15 minutes. Dedicated hotline.',
    reportName: 'Clinic Visit Report',
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
