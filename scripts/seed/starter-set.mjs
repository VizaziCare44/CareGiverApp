// The starter set (Test_Data_Strategy.md §3.1 to §3.4): 9 profiles, 5 care recipients, 8 bookings,
// the caregivers' verification history and the visits of B6 and B7. ALL OF THIS IS DATA, so
// changing the set is an edit to this file and nothing else.
//
// Checked row for row against Test_Data_Strategy.md on 2026-11-06 (VIZ-90): who owns which
// recipient and what each booking is are §3.1 to §3.3; the verification rows are §3.4; the dates
// are §3.3 (B3, B4 and B5 fall 3 Nairobi days after the day of seeding, at 09:00, 11:00 and 14:00;
// B6 and B7 are in the past). Names say "Test" and the care notes are invented sentences (§3).
//
// Counts: 9 + 5 + 8 = 22 rows, plus the matching auth users. Statuses: requested 2, assigned 3,
// in_progress 1, completed 1, cancelled 1. MediCheck 5, Doctor's Day Out 3.
//
// The accounts module makes every booking `requested`, except B8, which it makes `cancelled` (a
// cancelled booking has no caregiver, so it needs nothing else). The `verification` module then
// assigns B3 to B7 and moves B6 and B7 on, and the `visit` module gives B6 and B7 their visits.
//
// Two bookings share a recipient AND a bundle (B6 and B7: recipient 4A, MediCheck), so a booking
// is found again by recipient, bundle and the order it was created in (see `occurrence` below).

export const EMAIL_DOMAIN = 'test.vizazicare.example'

export const ACCOUNTS = [
  { key: 'admin1', role: 'admin', fullName: 'Test Admin', phone: '+254000000001' },
  { key: 'cg1', role: 'caregiver', fullName: 'Test Caregiver 1', phone: '+254000000011' },
  { key: 'cg2', role: 'caregiver', fullName: 'Test Caregiver 2', phone: '+254000000012' },
  // cg3 is a test-only extra, not a pilot persona: a Caregiver who is Not verified, with no history
  { key: 'cg3', role: 'caregiver', fullName: 'Test Caregiver 3', phone: '+254000000013' },
  { key: 'fm1', role: 'family_member', fullName: 'Test Family 1', phone: '+254000000021' },
  { key: 'fm2', role: 'family_member', fullName: 'Test Family 2', phone: '+254000000022' },
  { key: 'fm3', role: 'family_member', fullName: 'Test Family 3', phone: '+254000000023' },
  { key: 'fm4', role: 'family_member', fullName: 'Test Family 4', phone: '+254000000024' },
  // fm5 has no recipient and no booking: the first-time empty state
  { key: 'fm5', role: 'family_member', fullName: 'Test Family 5', phone: '+254000000025' },
].map((account) => ({ ...account, email: `${account.key}@${EMAIL_DOMAIN}` }))

// §3.2: recipient 4A's care note is exactly 2,000 characters, with apostrophes, accents and line
// breaks, to check a long note is stored and shown in full. It is a size check, not a boundary test:
// FD-ACC sets no care-notes limit (care_notes is plain text; §9(i)).
export const LONG_CARE_NOTE_LENGTH = 2000
export function longCareNote(head = 'Test note 4A: allergic to penicillin.') {
  const line = "\nMaman’s tea at 4 o'clock, café au lait, no sugar; she doesn't like the décor changed."
  let note = head
  while (note.length < LONG_CARE_NOTE_LENGTH - 1) note += line
  return note.slice(0, LONG_CARE_NOTE_LENGTH - 1) + '.'
}

export const RECIPIENTS = [
  { key: '1A', owner: 'fm1', name: 'Test Recipient 1A', careNotes: 'Test note: likes tea at 10am.' },
  // a second recipient on one account (BR-003)
  { key: '1B', owner: 'fm1', name: 'Test Recipient 1B', careNotes: 'Test note: prefers the radio on.' },
  { key: '2A', owner: 'fm2', name: 'Test Recipient 2A', careNotes: 'Test note: takes tablets with breakfast.' },
  // blank care notes (AC-004)
  { key: '3A', owner: 'fm3', name: 'Test Recipient 3A', careNotes: null },
  { key: '4A', owner: 'fm4', name: 'Test Recipient 4A', careNotes: longCareNote() },
]

// `days` after today in Nairobi, at `hour`:00 Nairobi time. B3, B4 and B5 fall 3 Nairobi days after the
// day of seeding, so they are always before their visit day; B3 and B5 (both cg1) are on one Nairobi
// day, at 09:00 and 14:00 (§3.3, FD-VERIFY §7.8(k)). B6 and B7 are in the past, with their visit times
// inside their booked day. B1, B2 and B8 are dated further ahead (the document does not fix them).
export const BOOKINGS = [
  { key: 'B1', recipient: '1A', bundle: 'medicheck', days: 2, hour: 9 }, // requested: Admin queue, assign happy path
  { key: 'B2', recipient: '1B', bundle: 'doctors_day_out', days: 4, hour: 9 }, // requested: second item in the queue
  { key: 'B3', recipient: '2A', bundle: 'medicheck', days: 3, hour: 9 }, // assigned to cg1: reassign target
  { key: 'B4', recipient: '2A', bundle: 'doctors_day_out', days: 3, hour: 11 }, // assigned to cg2: cg1 must not see it
  { key: 'B5', recipient: '3A', bundle: 'doctors_day_out', days: 3, hour: 14 }, // assigned to cg1: same day as B3
  { key: 'B6', recipient: '4A', bundle: 'medicheck', days: -1, hour: 9 }, // in progress with cg2: reassign blocked
  { key: 'B7', recipient: '4A', bundle: 'medicheck', days: -2, hour: 9 }, // completed with cg1: visit history
  { key: 'B8', recipient: '3A', bundle: 'medicheck', days: 7, hour: 9, status: 'cancelled' }, // status enum coverage
]

/** Which of the bookings sharing this one's recipient and bundle it is (0 for the first created). */
export function occurrence(booking) {
  return BOOKINGS.filter((b) => b.recipient === booking.recipient && b.bundle === booking.bundle).findIndex((b) => b.key === booking.key)
}

// §3.4: cg1 and cg2 are Verified (one `verified` row each, actor admin1, created 7 days before seeding,
// note "test seed"); cg3 has no row. A caregiver's state is one of 'verified', 'removed' (a verified
// row, then a removed row) or 'none' (no rows); the module can bring a caregiver to any of them.
export const VERIFICATION_NOTE = 'test seed'
export const VERIFICATION_AGE_DAYS = 7
export const VERIFICATION = [
  { caregiver: 'cg1', state: 'verified' },
  { caregiver: 'cg2', state: 'verified' },
  { caregiver: 'cg3', state: 'none' },
]

// §3.3 and §3.4: the assigned bookings get their assigned_by / assigned_at and their booking_assignments
// row, as assign_booking leaves them; B6 and B7 are then moved on to in progress and completed.
export const ASSIGNMENTS = [
  { booking: 'B3', caregiver: 'cg1', status: 'assigned' },
  { booking: 'B4', caregiver: 'cg2', status: 'assigned' },
  { booking: 'B5', caregiver: 'cg1', status: 'assigned' },
  { booking: 'B6', caregiver: 'cg2', status: 'in_progress' },
  { booking: 'B7', caregiver: 'cg1', status: 'completed' },
]

// The visits of the starter set (FD-VISIT DEV-070 item 1), written by the `visit` module (visit.mjs).
// B6 is open (cg2): Medication assistance is Done after one earlier entry was changed (so the append-only
// history has a case), and the Required task left unlogged is Vitals check (TECHNICAL DECISION, PROPOSED,
// Test_Data_Strategy.md §7, so that every run is the same); Companionship has no entry either. B7 is
// closed (cg1): every task has an entry, there is a note about the visit and both times. B6 and B7 are
// dated in the past in Nairobi (BOOKINGS above), and every time here is inside the booked day: `h`:`m` is
// Nairobi time on that day. The tasks are named as the checklist names them (checklist_items); the
// snapshot is copied from there. The wording of the notes is test data.
export const VISITS = [
  {
    booking: 'B6',
    caregiver: 'cg2',
    checkedIn: { h: 9, m: 5 },
    checkedOut: null,
    visitNote: null,
    entries: [
      { task: 'Medication assistance', outcome: 'not_done', reason: 'The tablets had not been delivered yet.', at: { h: 9, m: 20 } },
      { task: 'Medication assistance', outcome: 'done', note: 'Gave the morning tablets with water once they arrived.', at: { h: 9, m: 50 } },
    ],
  },
  {
    booking: 'B7',
    caregiver: 'cg1',
    checkedIn: { h: 9, m: 10 },
    checkedOut: { h: 12, m: 15 },
    visitNote: 'A calm morning; she ate well and asked for the radio.',
    entries: [
      { task: 'Medication assistance', outcome: 'done', note: null, at: { h: 9, m: 25 } },
      { task: 'Vitals check', outcome: 'done', note: 'Blood pressure 128/82, glucose 6.4 before breakfast.', at: { h: 10, m: 0 } },
      { task: 'Companionship', outcome: 'done', note: 'Played cards for an hour.', at: { h: 11, m: 30 } },
    ],
  },
]

export const STARTER_SET = { EMAIL_DOMAIN, ACCOUNTS, RECIPIENTS, BOOKINGS, VERIFICATION, ASSIGNMENTS, VISITS }
