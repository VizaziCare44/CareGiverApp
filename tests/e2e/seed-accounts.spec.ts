import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { formatDate, formatTime } from '../../lib/datetime'
import { ACCOUNTS, BOOKINGS, RECIPIENTS, occurrence } from '../../scripts/seed/starter-set.mjs'
import { anonClient, serviceClient } from './helpers'
import { makeBooking, makeFamily, nairobiTime } from './factories'

// DEV-054: the accounts module of the test seed, run for real through its command
// (`npm run seed`) against whatever project NEXT_PUBLIC_SUPABASE_URL points at (CI:
// the local stack). The starter set is shared, fixed rows, so these tests run one
// after another, and any test that changes a row puts it back. The data is Test_Data_Strategy.md
// §3.1 to §3.3 (checked 2026-11-06, VIZ-90).

test.describe.configure({ mode: 'serial' })

const PASSWORD = `Seed-${Date.now().toString(36)}-Pw!x`

function seed(env: Record<string, string | undefined> = {}, args: string[] = []) {
  const result = spawnSync(process.execPath, ['scripts/seed.mjs', ...args], {
    encoding: 'utf8',
    env: { ...process.env, SEED_TEST_PASSWORD: PASSWORD, ...env },
  })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function summaryOf(stdout: string) {
  const json = stdout.slice(stdout.indexOf('{'))
  return JSON.parse(json) as {
    accounts: { created: number; restored: number }
    recipients: { created: number; restored: number }
    bookings: { created: number; redated: number; left: number }
  }
}

const emails = ACCOUNTS.map((account) => account.email)
const svc = () => serviceClient()

async function seedRows() {
  const profiles = (await svc().from('profiles').select('id, email, role, full_name, phone').in('email', emails)).data ?? []
  const ownerIds = Object.fromEntries(profiles.map((p) => [p.email, p.id as string]))
  const recipientNames = RECIPIENTS.map((r) => r.name)
  const recipients = (await svc().from('care_recipients').select('id, account_id, name, care_notes').in('name', recipientNames)).data ?? []
  const recipientIds = recipients.map((r) => r.id as string)
  const bookings = (await svc().from('bookings').select('id, care_recipient_id, bundle_code, status, requested_datetime, assigned_caregiver_id, created_at').in('care_recipient_id', recipientIds)).data ?? []
  return { profiles, ownerIds, recipients, bookings }
}

/** One starter-set booking: B6 and B7 share a recipient and a bundle, so the row is found by the order it was created in. */
function rowOf(recipients: { id: string; name: string }[], bookings: Record<string, any>[], key: string) {
  const def = BOOKINGS.find((b) => b.key === key)!
  const recipient = recipients.find((r) => r.name === RECIPIENTS.find((x) => x.key === def.recipient)!.name)!
  return bookings
    .filter((b) => b.care_recipient_id === recipient.id && b.bundle_code === def.bundle)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)))[occurrence(def)]
}

test.describe('DEV-054 — test seed, accounts module', () => {
  test('refuses to run on production or any project not on the allow-list, before it connects', async () => {
    const fake = { SUPABASE_SERVICE_ROLE_KEY: 'not-a-real-key' }
    for (const url of [
      'https://abcdefghijklmnopqrst.supabase.co',
      'https://fzkwbajawfircwfzwbjg.supabase.co.evil.test',
      'https://localhost.evil.test',
      'https://notfzkwbajawfircwfzwbjg.supabase.co',
    ]) {
      const result = seed({ NEXT_PUBLIC_SUPABASE_URL: url, ...fake })
      expect(result.status, url).toBe(1)
      expect(result.stderr, url).toContain('Refusing to run')
      expect(result.stderr).toContain('never to production')
      expect(result.stdout).not.toContain('Project:')
      expect(result.stdout).not.toContain('Seeded module')
    }
  })

  test('needs a shared password from the environment, at least 12 characters, and a known module', async () => {
    for (const password of [undefined, '', 'short-pw']) {
      const result = seed({ SEED_TEST_PASSWORD: password })
      expect(result.status, String(password)).toBe(1)
      expect(result.stderr).toContain('SEED_TEST_PASSWORD is required')
      expect(result.stdout).not.toContain('Project:')
    }
    const unknown = seed({}, ['--module', 'everything'])
    expect(unknown.status).toBe(1)
    expect(unknown.stderr).toContain('Unknown module')
    expect(unknown.stdout).not.toContain('Project:')
    // the password is never printed
    const ok = seed()
    expect(ok.status, ok.stderr).toBe(0)
    expect(ok.stdout + ok.stderr).not.toContain(PASSWORD)
  })

  test('creates the starter set: 9 profiles, 5 recipients, 8 bookings, on test.vizazicare.example addresses', async () => {
    expect(ACCOUNTS).toHaveLength(9)
    expect(RECIPIENTS).toHaveLength(5)
    expect(BOOKINGS).toHaveLength(8)
    const run = seed()
    expect(run.status, run.stderr).toBe(0)

    const { profiles, ownerIds, recipients, bookings } = await seedRows()
    expect(profiles).toHaveLength(9)
    for (const account of ACCOUNTS) {
      expect(account.email).toMatch(/^(admin1|cg[1-3]|fm[1-5])@test\.vizazicare\.example$/)
      expect(account.fullName, 'all names say Test (§3)').toMatch(/^Test /)
      expect(profiles.find((p) => p.email === account.email)).toMatchObject({ role: account.role, full_name: account.fullName, phone: account.phone })
    }
    expect(profiles.filter((p) => p.role === 'admin')).toHaveLength(1)
    expect(profiles.filter((p) => p.role === 'caregiver')).toHaveLength(3)
    expect(profiles.filter((p) => p.role === 'family_member')).toHaveLength(5)

    // every account signs in with the shared password, created the way a real sign-up leaves it
    for (const account of ACCOUNTS) {
      const signedIn = await anonClient().auth.signInWithPassword({ email: account.email, password: PASSWORD })
      expect(signedIn.error, account.email).toBeNull()
    }

    // recipients belong to the right family; fm5 has none (the first-time empty state)
    expect(recipients).toHaveLength(5)
    for (const recipient of RECIPIENTS) {
      const row = recipients.find((r) => r.name === recipient.name)!
      expect(row.account_id).toBe(ownerIds[`${recipient.owner}@test.vizazicare.example`])
      expect(row.care_notes).toBe(recipient.careNotes)
    }
    expect(recipients.filter((r) => r.account_id === ownerIds['fm5@test.vizazicare.example'])).toHaveLength(0)
    // §3.2: fm1 has two recipients, fm2, fm3 and fm4 one each; 3A is blank; 4A is exactly 2,000 characters
    const countOf = (key: string) => recipients.filter((r) => r.account_id === ownerIds[`${key}@test.vizazicare.example`]).length
    expect([countOf('fm1'), countOf('fm2'), countOf('fm3'), countOf('fm4'), countOf('fm5')]).toEqual([2, 1, 1, 1, 0])
    expect(recipients.find((r) => r.name === 'Test Recipient 3A')!.care_notes).toBeNull()
    expect(recipients.find((r) => r.name === 'Test Recipient 4A')!.care_notes).toHaveLength(2000)

    // eight bookings. The accounts module makes them all requested; a run that has also seeded
    // verification (the default) has moved some on, so only the rule is checked here: a requested
    // booking has no caregiver (the verification module has its own tests)
    expect(bookings).toHaveLength(8)
    expect(bookings.every((b) => (b.status === 'requested') === (b.assigned_caregiver_id === null) || b.status === 'cancelled')).toBe(true)
    // §3.3: the owner, the recipient and the bundle of each booking, and B8 is created cancelled with no caregiver
    const owners: Record<string, string> = { B1: 'fm1', B2: 'fm1', B3: 'fm2', B4: 'fm2', B5: 'fm3', B6: 'fm4', B7: 'fm4', B8: 'fm3' }
    const bundles: Record<string, string> = { B1: 'medicheck', B2: 'doctors_day_out', B3: 'medicheck', B4: 'doctors_day_out', B5: 'doctors_day_out', B6: 'medicheck', B7: 'medicheck', B8: 'medicheck' }
    for (const def of BOOKINGS) {
      const row = rowOf(recipients, bookings, def.key)
      expect(row, def.key).toBeTruthy()
      expect(row.bundle_code, def.key).toBe(bundles[def.key])
      const recipient = recipients.find((r) => r.id === row.care_recipient_id)!
      expect(recipient.account_id, def.key).toBe(ownerIds[`${owners[def.key]}@test.vizazicare.example`])
    }
    expect(rowOf(recipients, bookings, 'B8').status).toBe('cancelled')
    expect(rowOf(recipients, bookings, 'B8').assigned_caregiver_id).toBeNull()
    // B6 and B7 are two different rows
    expect(rowOf(recipients, bookings, 'B6').id).not.toBe(rowOf(recipients, bookings, 'B7').id)
  })

  test('dates are in Africa/Nairobi: B3 and B5 are on one Nairobi day, at 09:00 and 14:00, and B4 at 11:00 (§3.3)', async () => {
    const { recipients, bookings } = await seedRows()
    const visit = (key: string) => rowOf(recipients, bookings, key).requested_datetime as string
    expect(formatDate(visit('B3'))).toBe(formatDate(visit('B5')))
    expect(formatTime(visit('B3'))).toBe('09:00 EAT')
    expect(formatTime(visit('B4'))).toBe('11:00 EAT')
    expect(formatTime(visit('B5'))).toBe('14:00 EAT')
    // B6 and B7 are in the past
    expect(new Date(visit('B6')).getTime()).toBeLessThan(Date.now())
    expect(new Date(visit('B7')).getTime()).toBeLessThan(Date.now())
    // and every booking is the day offset it says, at the hour it says, in Nairobi
    for (const def of BOOKINGS) {
      const expected = nairobiTime({ days: def.days, hour: def.hour })
      const actual = new Date(visit(def.key))
      // allow for the seed having run just before or after Nairobi midnight
      expect(Math.abs(actual.getTime() - expected.getTime()) % (24 * 3600 * 1000), def.key).toBe(0)
      expect(formatTime(actual)).toBe(`${String(def.hour).padStart(2, '0')}:00 EAT`)
    }
  })

  test('writes no verification or assignment rows of its own: those are the verification module', async () => {
    const count = async (table: string) => (await svc().from(table).select('id', { count: 'exact', head: true })).count
    const before = { history: await count('caregiver_verifications'), assignments: await count('booking_assignments') }
    const run = seed({}, ['--module', 'accounts'])
    expect(run.status, run.stderr).toBe(0)
    expect({ history: await count('caregiver_verifications'), assignments: await count('booking_assignments') }).toEqual(before)
  })

  test('is idempotent: a second run creates nothing and the same rows are still there', async () => {
    const before = await seedRows()
    const run = seed()
    expect(run.status, run.stderr).toBe(0)
    const summary = summaryOf(run.stdout)
    expect(summary.accounts.created).toBe(0)
    expect(summary.recipients.created).toBe(0)
    expect(summary.bookings.created).toBe(0)
    expect(summary.accounts.restored).toBe(9)

    const after = await seedRows()
    expect(after.profiles.map((p) => p.id).sort()).toEqual(before.profiles.map((p) => p.id).sort())
    expect(after.recipients.map((r) => r.id).sort()).toEqual(before.recipients.map((r) => r.id).sort())
    expect(after.bookings.map((b) => b.id).sort()).toEqual(before.bookings.map((b) => b.id).sort())
  })

  test('restores what changed: a password, a name, a role, care notes and a requested booking\'s date', async () => {
    const { ownerIds, recipients, bookings } = await seedRows()
    const fm1 = ownerIds['fm1@test.vizazicare.example']
    const cg2 = ownerIds['cg2@test.vizazicare.example']
    const r1 = recipients.find((r) => r.name === 'Test Recipient 1A')!
    const b1 = rowOf(recipients, bookings, 'B1')

    expect((await svc().auth.admin.updateUserById(fm1, { password: 'Someone-Changed-It-1!' })).error).toBeNull() // not a secret: a throwaway value
    expect((await svc().from('profiles').update({ full_name: 'Renamed' }).eq('id', fm1)).error).toBeNull()
    expect((await svc().from('profiles').update({ role: 'family_member' }).eq('id', cg2)).error).toBeNull()
    expect((await svc().from('care_recipients').update({ care_notes: 'Changed notes' }).eq('id', r1.id)).error).toBeNull()
    expect((await svc().from('bookings').update({ requested_datetime: '2031-05-05T06:00:00.000Z' }).eq('id', b1.id)).error).toBeNull()

    const run = seed()
    expect(run.status, run.stderr).toBe(0)

    const signedIn = await anonClient().auth.signInWithPassword({ email: 'fm1@test.vizazicare.example', password: PASSWORD })
    expect(signedIn.error).toBeNull()
    const profiles = (await svc().from('profiles').select('id, role, full_name').in('id', [fm1, cg2])).data ?? []
    expect(profiles.find((p) => p.id === fm1)?.full_name).toBe('Test Family 1')
    expect(profiles.find((p) => p.id === cg2)?.role).toBe('caregiver')
    expect((await svc().from('care_recipients').select('care_notes').eq('id', r1.id).single()).data?.care_notes).toBe('Test note: likes tea at 10am.')
    const b1After = (await svc().from('bookings').select('requested_datetime').eq('id', b1.id).single()).data!
    expect(formatTime(b1After.requested_datetime)).toBe('09:00 EAT')
    expect(new Date(b1After.requested_datetime).getFullYear()).not.toBe(2031)
  })

  test('leaves a booking that has moved on exactly as it is, and never deletes', async () => {
    const { ownerIds, recipients, bookings } = await seedRows()
    const b2 = rowOf(recipients, bookings, 'B2')
    const admin = ownerIds['admin1@test.vizazicare.example']
    const cg1 = ownerIds['cg1@test.vizazicare.example']
    const movedTo = '2031-06-06T06:00:00.000Z'

    try {
      const moved = await svc()
        .from('bookings')
        .update({ status: 'assigned', assigned_caregiver_id: cg1, assigned_by: admin, assigned_at: new Date().toISOString(), requested_datetime: movedTo })
        .eq('id', b2.id)
      expect(moved.error).toBeNull()

      const run = seed()
      expect(run.status, run.stderr).toBe(0)
      const summary = summaryOf(run.stdout)
      expect(summary.bookings.left).toBeGreaterThanOrEqual(1) // this one, and any the verification module has moved on
      expect(summary.bookings.created).toBe(0)

      const after = (await svc().from('bookings').select('status, requested_datetime, assigned_caregiver_id').eq('id', b2.id).single()).data!
      expect(after.status).toBe('assigned')
      expect(after.assigned_caregiver_id).toBe(cg1)
      expect(new Date(after.requested_datetime).toISOString()).toBe(movedTo)
      expect((await seedRows()).bookings).toHaveLength(8)
    } finally {
      // put the starter-set row back, so running these tests on a shared project leaves it as it was
      await svc().from('bookings').update({ status: 'requested', assigned_caregiver_id: null, assigned_by: null, assigned_at: null }).eq('id', b2.id)
      seed()
    }
  })

  test('touches nothing outside the starter set', async () => {
    const family = await makeFamily()
    const booking = await makeBooking({ family })
    const before = {
      profile: (await svc().from('profiles').select('role, full_name').eq('id', family.userId).single()).data,
      booking: (await svc().from('bookings').select('status, requested_datetime, care_recipient_id').eq('id', booking.id).single()).data,
    }
    const run = seed()
    expect(run.status, run.stderr).toBe(0)
    const after = {
      profile: (await svc().from('profiles').select('role, full_name').eq('id', family.userId).single()).data,
      booking: (await svc().from('bookings').select('status, requested_datetime, care_recipient_id').eq('id', booking.id).single()).data,
    }
    expect(after).toEqual(before)
    expect((await seedRows()).profiles).toHaveLength(9)
  })
})
