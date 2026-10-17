import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { formatDate, formatTime } from '../../lib/datetime'
import { ACCOUNTS, BOOKINGS, RECIPIENTS } from '../../scripts/seed/starter-set.mjs'
import { anonClient, serviceClient } from './helpers'
import { makeBooking, makeFamily, nairobiTime } from './factories'

// DEV-054: the accounts module of the test seed, run for real through its command
// (`npm run seed`) against whatever project NEXT_PUBLIC_SUPABASE_URL points at (CI:
// the local stack). The starter set is shared, fixed rows, so these tests run one
// after another, and any test that changes a row puts it back.

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
  const bookings = (await svc().from('bookings').select('id, care_recipient_id, bundle_code, status, requested_datetime, assigned_caregiver_id').in('care_recipient_id', recipientIds)).data ?? []
  return { profiles, ownerIds, recipients, bookings }
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

    // eight bookings, all requested: the only status FD-ACC can write
    expect(bookings).toHaveLength(8)
    expect(new Set(bookings.map((b) => b.status))).toEqual(new Set(['requested']))
    expect(bookings.every((b) => b.assigned_caregiver_id === null)).toBe(true)
  })

  test('dates are in Africa/Nairobi: B3 and B5 are on one Nairobi day, at 09:00 and 14:00', async () => {
    const { recipients, bookings } = await seedRows()
    const visit = (key: string) => {
      const def = BOOKINGS.find((b) => b.key === key)!
      const recipient = recipients.find((r) => r.name === RECIPIENTS.find((x) => x.key === def.recipient)!.name)!
      return bookings.find((b) => b.care_recipient_id === recipient.id && b.bundle_code === def.bundle)!.requested_datetime as string
    }
    expect(formatDate(visit('B3'))).toBe(formatDate(visit('B5')))
    expect(formatTime(visit('B3'))).toBe('09:00 EAT')
    expect(formatTime(visit('B5'))).toBe('14:00 EAT')
    // and every booking is the day offset it says, at the hour it says, in Nairobi
    for (const def of BOOKINGS) {
      const expected = nairobiTime({ days: def.days, hour: def.hour })
      const actual = new Date(visit(def.key))
      // allow for the seed having run just before or after Nairobi midnight
      expect(Math.abs(actual.getTime() - expected.getTime()) % (24 * 3600 * 1000), def.key).toBe(0)
      expect(formatTime(actual)).toBe(`${String(def.hour).padStart(2, '0')}:00 EAT`)
    }
  })

  test('writes no verification or assignment rows: those are DEV-051', async () => {
    const { ownerIds, bookings } = await seedRows()
    const caregiverIds = ['cg1', 'cg2', 'cg3'].map((key) => ownerIds[`${key}@test.vizazicare.example`])
    const history = await svc().from('caregiver_verifications').select('id', { count: 'exact', head: true }).in('caregiver_id', caregiverIds)
    expect(history.count).toBe(0)
    const assignments = await svc().from('booking_assignments').select('id', { count: 'exact', head: true }).in('booking_id', bookings.map((b) => b.id))
    expect(assignments.count).toBe(0)
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
    const r1 = recipients.find((r) => r.name === 'Seed Recipient 1')!
    const b1 = bookings.find((b) => b.care_recipient_id === r1.id && b.bundle_code === 'medicheck')!

    expect((await svc().auth.admin.updateUserById(fm1, { password: 'Someone-Changed-It-1!' })).error).toBeNull()
    expect((await svc().from('profiles').update({ full_name: 'Renamed' }).eq('id', fm1)).error).toBeNull()
    expect((await svc().from('profiles').update({ role: 'family_member' }).eq('id', cg2)).error).toBeNull()
    expect((await svc().from('care_recipients').update({ care_notes: 'Changed notes' }).eq('id', r1.id)).error).toBeNull()
    expect((await svc().from('bookings').update({ requested_datetime: '2031-05-05T06:00:00.000Z' }).eq('id', b1.id)).error).toBeNull()

    const run = seed()
    expect(run.status, run.stderr).toBe(0)

    const signedIn = await anonClient().auth.signInWithPassword({ email: 'fm1@test.vizazicare.example', password: PASSWORD })
    expect(signedIn.error).toBeNull()
    const profiles = (await svc().from('profiles').select('id, role, full_name').in('id', [fm1, cg2])).data ?? []
    expect(profiles.find((p) => p.id === fm1)?.full_name).toBe('Family One')
    expect(profiles.find((p) => p.id === cg2)?.role).toBe('caregiver')
    expect((await svc().from('care_recipients').select('care_notes').eq('id', r1.id).single()).data?.care_notes).toBe('Seed care note 1: takes tablets with breakfast.')
    const b1After = (await svc().from('bookings').select('requested_datetime').eq('id', b1.id).single()).data!
    expect(formatTime(b1After.requested_datetime)).toBe('09:00 EAT')
    expect(new Date(b1After.requested_datetime).getFullYear()).not.toBe(2031)
  })

  test('leaves a booking that has moved on exactly as it is, and never deletes', async () => {
    const { ownerIds, recipients, bookings } = await seedRows()
    const r1 = recipients.find((r) => r.name === 'Seed Recipient 1')!
    const b2 = bookings.find((b) => b.care_recipient_id === r1.id && b.bundle_code === 'doctors_day_out')!
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
      expect(summary.bookings.left).toBe(1)
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
