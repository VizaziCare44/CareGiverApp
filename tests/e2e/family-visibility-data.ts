import { serviceClient } from './helpers'
import {
  factoryAdmin,
  makeBooking,
  makeCaregiver,
  makeFamily,
  makeRecipient,
  makeVisit,
  nairobiDay,
  today,
  type TestBooking,
  type TestCaregiver,
  type TestRecipient,
  type TestUser,
} from './factories'

// DEV-074: the test data for the family's visit report (Test_Data_Strategy.md §7, §5): the module
// `seedFamilyVisibility`. It is factory-built PER TEST, not starter data, so the starter set (B1 to B8)
// is unchanged, and every visit is made with makeVisit through the caregiver's own session (the real
// check_in, log_visit_task and check_out, never the service role; the DEV-070 rule), each with a fresh
// makeCaregiver because a caregiver has one visit open at a time. Every case is dated today in Nairobi
// (the default of the helpers), so no test clock is needed.
//
// DRAFT: the wording of the notes and reasons is test data. The cases are the ones DEV-074 lists.

export const LONG_TASK_NOTE_LENGTH = 2000
export const LONG_REASON_LENGTH = 500
export const LONG_VISIT_NOTE_LENGTH = 2000

/**
 * Text of exactly `length` characters (the way the database counts them) with apostrophes, accents and
 * line breaks, that begins `head`, never begins or ends with a space or a line break (the database
 * trims), and ends with a full stop.
 */
export function textOfLength(length: number, head: string) {
  const line = "\nMaman’s tea at 4 o'clock, café au lait, no sugar; she doesn't like the décor changed."
  let text = head
  while (text.length < length - 1) text += line
  const cut = text.slice(0, length - 1)
  // a cut that leaves a trailing space or line break would be trimmed by the database
  return cut.replace(/\s+$/, 'x') + '.'
}

export const MULTI_LINE_READINGS = 'Blood pressure 128/82\nGlucose 6.4 before breakfast\n\nTemperature 36.8, no fever'
export const MULTI_LINE_VISIT_NOTE = 'A calm morning.\n\nShe asked for the radio on and ate well.'

export interface ReportCase {
  family: TestUser
  recipient: TestRecipient
  caregiver: TestCaregiver
  booking: TestBooking
}

export interface FamilyVisibilityData {
  /** The family of the four reports below */
  family: TestUser
  /** A second factory family, for the cross-family cases: it owns nothing here */
  otherFamily: TestUser
  /** MediCheck, completed: Medication assistance Not done after one earlier Done (a changed task, with a reason), Vitals check Done with a multi-line note, Companionship never logged, a multi-line visit note */
  medicheck: ReportCase
  /** Doctor's Day Out, completed: Advocacy and note-taking Not done with a reason, Pre-visit preparation (the Optional task) never logged */
  clinic: ReportCase
  /** MediCheck, completed, with a 2,000-character task note, a 500-character reason and a 2,000-character visit note */
  long: ReportCase & { taskNote: string; reason: string; visitNote: string }
  /** completed, whose caregiver has since lost Verified (BR-006, AC-014) */
  lostVerified: ReportCase
  /** a booking completed by hand without a visit (F4), for its own factory family */
  noVisit: ReportCase
  /** a booking in progress with a partly logged set (F2), for its own factory family */
  inProgress: ReportCase
}

async function completed(family: TestUser, recipient: TestRecipient, bundle: TestBooking['bundle'], plan: Omit<Parameters<typeof makeVisit>[0], 'booking' | 'caregiver' | 'closed'>) {
  const caregiver = await makeCaregiver({ verified: true })
  const booking = await makeBooking({ family, recipient, bundle, status: 'assigned', caregiver, visit: nairobiDay(today) })
  const visit = await makeVisit({ ...plan, booking, caregiver, closed: true })
  return { family, recipient, caregiver, booking: { ...booking, status: 'completed' as const, visitId: visit.id } }
}

export async function seedFamilyVisibility(): Promise<FamilyVisibilityData> {
  const family = await makeFamily()
  const otherFamily = await makeFamily()

  // MediCheck: a changed task, a reason, multi-line text
  const recipient1 = await makeRecipient({ family, name: 'Report Recipient One' })
  const medicheck = await completed(family, recipient1, 'medicheck', {
    tasks: [
      { key: 'Medication assistance', outcome: 'done', note: 'Gave the morning tablets' },
      { key: 'Medication assistance', outcome: 'not_done', reason: 'She refused the second dose' },
      { key: 'Vitals check', outcome: 'done', note: MULTI_LINE_READINGS },
    ],
    visitNote: MULTI_LINE_VISIT_NOTE,
  })

  // Doctor's Day Out: Advocacy Not done with a reason; Pre-visit preparation never logged
  const recipient2 = await makeRecipient({ family, name: 'Report Recipient Two' })
  const clinic = await completed(family, recipient2, 'doctors_day_out', {
    tasks: [
      { key: 'Advocacy and note-taking', outcome: 'not_done', reason: 'The doctor ran late and we left before the discussion' },
      { key: 'Post-visit summary', outcome: 'done', note: 'Review in two weeks. New tablet each evening.' },
    ],
  })

  // the longest texts the screens accept, with apostrophes, accents and line breaks
  const taskNote = textOfLength(LONG_TASK_NOTE_LENGTH, 'Readings: ')
  const reason = textOfLength(LONG_REASON_LENGTH, 'She would not take it: ')
  const visitNote = textOfLength(LONG_VISIT_NOTE_LENGTH, 'About the visit: ')
  const recipient3 = await makeRecipient({ family, name: 'Report Recipient Three' })
  const longCase = await completed(family, recipient3, 'medicheck', {
    tasks: [
      { key: 'Medication assistance', outcome: 'not_done', reason },
      { key: 'Vitals check', outcome: 'done', note: taskNote },
    ],
    visitNote,
  })

  // completed, and the caregiver has since lost Verified: the report does not change (BR-006, AC-014)
  const recipient4 = await makeRecipient({ family, name: 'Report Recipient Four' })
  const lost = await completed(family, recipient4, 'medicheck', {
    tasks: [{ key: 'Vitals check', outcome: 'done', note: 'Blood pressure 120/80' }],
    visitNote: 'Nothing to report',
  })
  const admin = await factoryAdmin()
  const removed = await serviceClient()
    .from('caregiver_verifications')
    .insert({ caregiver_id: lost.caregiver.userId, action: 'removed', note: 'Factory: Verified removed after the visit', acted_by: admin.userId })
  if (removed.error) throw new Error(`seedFamilyVisibility: could not remove Verified: ${removed.error.message}`)

  // F4: completed by hand with no visit at all, for its own family
  const noVisitFamily = await makeFamily()
  const noVisitRecipient = await makeRecipient({ family: noVisitFamily })
  const noVisitCaregiver = await makeCaregiver({ verified: true })
  const noVisitBooking = await makeBooking({ family: noVisitFamily, recipient: noVisitRecipient, status: 'assigned', caregiver: noVisitCaregiver })
  const byHand = await serviceClient().from('bookings').update({ status: 'completed' }).eq('id', noVisitBooking.id)
  if (byHand.error) throw new Error(`seedFamilyVisibility: could not complete the booking by hand: ${byHand.error.message}`)

  // F2: in progress with a partly logged set, for its own family
  const progressFamily = await makeFamily()
  const progressRecipient = await makeRecipient({ family: progressFamily })
  const progressCaregiver = await makeCaregiver({ verified: true })
  const progressBooking = await makeBooking({ family: progressFamily, recipient: progressRecipient, status: 'assigned', caregiver: progressCaregiver, visit: nairobiDay(today) })
  await makeVisit({ booking: progressBooking, caregiver: progressCaregiver, tasks: [{ key: 'Medication assistance', outcome: 'done', note: 'Gave the morning tablets' }] })

  return {
    family,
    otherFamily,
    medicheck,
    clinic,
    long: { ...longCase, taskNote, reason, visitNote },
    lostVerified: lost,
    noVisit: { family: noVisitFamily, recipient: noVisitRecipient, caregiver: noVisitCaregiver, booking: { ...noVisitBooking, status: 'completed' } },
    inProgress: { family: progressFamily, recipient: progressRecipient, caregiver: progressCaregiver, booking: { ...progressBooking, status: 'in_progress' } },
  }
}
