// The starter set (Test_Data_Strategy.md §3.1 to §3.3): 9 profiles, 5 care
// recipients, 8 bookings. ALL OF THIS IS DATA, so changing the set is an edit to
// this file and nothing else.
//
// DRAFT. The ticket (DEV-054) fixes the counts, the account names (admin1, cg1 to
// cg3, fm1 to fm5), the address domain, that B3 and B5 fall on one Nairobi day at
// 09:00 and 14:00, and that the verification and assignment rows are not part of
// it (DEV-051). Test_Data_Strategy.md, which says which family owns which
// recipient and what each booking is, was not available when this was written:
// the names, the owners, the bundles and the day offsets below are a draft to be
// corrected against it. What is certain from other tickets: B6 and B7 are meant to
// become "in progress" (cg2) and "completed" (cg1) later (DEV-070).
//
// Every booking here is created `requested`, the only status the FD-ACC write path
// can make: a booking with a caregiver needs assigned_by and assigned_at, which
// belong to DEV-051. Each (recipient, bundle) pair appears once, so the seed can
// find its own booking again on a second run.

export const EMAIL_DOMAIN = 'test.vizazicare.example'

export const ACCOUNTS = [
  { key: 'admin1', role: 'admin', fullName: 'Admin One', phone: '+254700000101' },
  { key: 'cg1', role: 'caregiver', fullName: 'Caregiver One', phone: '+254700000111' },
  { key: 'cg2', role: 'caregiver', fullName: 'Caregiver Two', phone: '+254700000112' },
  { key: 'cg3', role: 'caregiver', fullName: 'Caregiver Three', phone: '+254700000113' },
  { key: 'fm1', role: 'family_member', fullName: 'Family One', phone: '+254700000121' },
  { key: 'fm2', role: 'family_member', fullName: 'Family Two', phone: '+254700000122' },
  { key: 'fm3', role: 'family_member', fullName: 'Family Three', phone: '+254700000123' },
  { key: 'fm4', role: 'family_member', fullName: 'Family Four', phone: '+254700000124' },
  // fm5 has no recipient and no booking: the first-time empty state
  { key: 'fm5', role: 'family_member', fullName: 'Family Five', phone: '+254700000125' },
].map((account) => ({ ...account, email: `${account.key}@${EMAIL_DOMAIN}` }))

// DEV-070 item 4: recipient 4's care note is exactly 2,000 characters, with apostrophes, accents and line
// breaks, to check a long note is stored and shown in full. It is a size check, not a boundary test:
// FD-ACC sets no care-notes limit (care_notes is plain text).
export const LONG_CARE_NOTE_LENGTH = 2000
export function longCareNote(head = 'Seed care note 4: allergic to penicillin.') {
  const line = "\nMaman’s tea at 4 o'clock, café au lait, no sugar; she doesn't like the décor changed."
  let note = head
  while (note.length < LONG_CARE_NOTE_LENGTH - 1) note += line
  return note.slice(0, LONG_CARE_NOTE_LENGTH - 1) + '.'
}

export const RECIPIENTS = [
  { key: 'r1', owner: 'fm1', name: 'Seed Recipient 1', careNotes: 'Seed care note 1: takes tablets with breakfast.' },
  { key: 'r2', owner: 'fm1', name: 'Seed Recipient 2', careNotes: null },
  { key: 'r3', owner: 'fm2', name: 'Seed Recipient 3', careNotes: 'Seed care note 3: prefers the radio on.' },
  { key: 'r4', owner: 'fm3', name: 'Seed Recipient 4', careNotes: longCareNote() },
  { key: 'r5', owner: 'fm4', name: 'Seed Recipient 5', careNotes: null },
]

// `days` after today in Nairobi, at `hour`:`minute` Nairobi time. B3 and B5 are on
// one Nairobi day at 09:00 and 14:00 (§7.8(k)).
export const BOOKINGS = [
  { key: 'B1', recipient: 'r1', bundle: 'medicheck', days: 2, hour: 9 },
  { key: 'B2', recipient: 'r1', bundle: 'doctors_day_out', days: 4, hour: 9 },
  { key: 'B3', recipient: 'r2', bundle: 'medicheck', days: 3, hour: 9 },
  { key: 'B4', recipient: 'r3', bundle: 'medicheck', days: 3, hour: 11 },
  { key: 'B5', recipient: 'r4', bundle: 'doctors_day_out', days: 3, hour: 14 },
  { key: 'B6', recipient: 'r5', bundle: 'medicheck', days: 1, hour: 9 },
  { key: 'B7', recipient: 'r3', bundle: 'doctors_day_out', days: 6, hour: 9 },
  { key: 'B8', recipient: 'r2', bundle: 'doctors_day_out', days: 7, hour: 9 },
]

// The verification rows and assignments of the starter set (Test_Data_Strategy.md §3.4),
// written by the `verification` module (verification.mjs, DEV-051). ALSO A DRAFT: the
// document was not available, so which caregiver is Verified and which booking is in
// which state is a guess, chosen so every FD-VERIFY state has a row to look at:
//   cg1 Verified, cg2 Verified, cg3 was Verified and then removed (Not verified, with a history)
//   B1 assigned to cg1, B2 assigned to cg2        a Verified caregiver (Booking Detail state 2)
//   B4 assigned to cg3                            the caregiver is no longer Verified (state 3, and
//                                                 the Admin queue flag "Caregiver no longer Verified")
//   B6 in progress with cg2, B7 completed with cg1 (DEV-070 expects exactly these two)
//   B3, B5 and B8 stay requested, so there are always requests left to assign
// `days` and `hour` move a started or finished visit to now-ish (Nairobi time); without them the
// booking keeps the date the accounts module gave it. A caregiver's state is one of
// 'verified', 'removed' (a verified row, then a removed row) or 'none' (no rows).
export const VERIFICATION = [
  { caregiver: 'cg1', state: 'verified' },
  { caregiver: 'cg2', state: 'verified' },
  { caregiver: 'cg3', state: 'removed' },
]

export const ASSIGNMENTS = [
  { booking: 'B1', caregiver: 'cg1', status: 'assigned' },
  { booking: 'B2', caregiver: 'cg2', status: 'assigned' },
  { booking: 'B4', caregiver: 'cg3', status: 'assigned' },
  { booking: 'B6', caregiver: 'cg2', status: 'in_progress', days: -1, hour: 9 },
  { booking: 'B7', caregiver: 'cg1', status: 'completed', days: -2, hour: 9 },
]

// The visits of the starter set (DEV-070 item 1), written by the `visit` module (visit.mjs). B6 is open
// (cg2): Medication assistance is Done after one earlier entry was changed (so the append-only history
// has a case), and the Required task left unlogged is Vitals check (TECHNICAL DECISION, PROPOSED, so
// that every run is the same); Companionship has no entry either. B7 is closed (cg1): every task has an
// entry, there is a note about the visit and both times. B6 and B7 are dated in the past in Nairobi
// (the ASSIGNMENTS above), and every time here is inside the booked day: `h`:`m` is Nairobi time on
// that day. The tasks are named as the checklist names them (checklist_items); the snapshot is copied
// from there. The wording of the notes is draft test data, like the rest of the set.
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
    checkedOut: { h: 13, m: 30 },
    visitNote: 'Clinic ran late; we were home by half past one.',
    entries: [
      { task: 'Pre-visit preparation', outcome: 'done', note: null, at: { h: 9, m: 25 } },
      { task: 'Transport and escort', outcome: 'done', note: null, at: { h: 10, m: 40 } },
      { task: 'Advocacy and note-taking', outcome: 'done', note: 'Asked about the dizziness; the doctor will review it in two weeks.', at: { h: 12, m: 15 } },
      { task: 'Post-visit summary', outcome: 'done', note: 'New prescription: one tablet each evening. Next visit in two weeks.', at: { h: 13, m: 20 } },
    ],
  },
]

export const STARTER_SET = { EMAIL_DOMAIN, ACCOUNTS, RECIPIENTS, BOOKINGS, VERIFICATION, ASSIGNMENTS, VISITS }
