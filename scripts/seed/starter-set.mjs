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

export const RECIPIENTS = [
  { key: 'r1', owner: 'fm1', name: 'Seed Recipient 1', careNotes: 'Seed care note 1: takes tablets with breakfast.' },
  { key: 'r2', owner: 'fm1', name: 'Seed Recipient 2', careNotes: null },
  { key: 'r3', owner: 'fm2', name: 'Seed Recipient 3', careNotes: 'Seed care note 3: prefers the radio on.' },
  { key: 'r4', owner: 'fm3', name: 'Seed Recipient 4', careNotes: 'Seed care note 4: allergic to penicillin.' },
  { key: 'r5', owner: 'fm4', name: 'Seed Recipient 5', careNotes: null },
]

// `days` after today in Nairobi, at `hour`:`minute` Nairobi time. B3 and B5 are on
// one Nairobi day at 09:00 and 14:00 (§7.8(k)).
export const BOOKINGS = [
  { key: 'B1', recipient: 'r1', bundle: 'medicheck', days: 2, hour: 9 },
  { key: 'B2', recipient: 'r1', bundle: 'doctors_day_out', days: 4, hour: 9 },
  { key: 'B3', recipient: 'r2', bundle: 'medicheck', days: 3, hour: 9 },
  { key: 'B4', recipient: 'r3', bundle: 'medicheck', days: 5, hour: 9 },
  { key: 'B5', recipient: 'r4', bundle: 'doctors_day_out', days: 3, hour: 14 },
  { key: 'B6', recipient: 'r5', bundle: 'medicheck', days: 1, hour: 9 },
  { key: 'B7', recipient: 'r3', bundle: 'doctors_day_out', days: 6, hour: 9 },
  { key: 'B8', recipient: 'r2', bundle: 'doctors_day_out', days: 7, hour: 9 },
]

export const STARTER_SET = { EMAIL_DOMAIN, ACCOUNTS, RECIPIENTS, BOOKINGS }
