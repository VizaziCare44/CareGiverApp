import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { formatTime } from '../../lib/datetime'
import { ACCOUNTS, ASSIGNMENTS, BOOKINGS, RECIPIENTS, VERIFICATION } from '../../scripts/seed/starter-set.mjs'
import { anonClient, serviceClient } from './helpers'
import { makeAdmin } from './factories'

// DEV-051 (items 1 and 5): the verification module of the test seed, run for real
// through `npm run seed`: the caregivers' Verified history and the assigned, in
// progress and completed bookings on top of the accounts module, idempotent and
// append-only. The data it writes is the draft in scripts/seed/starter-set.mjs (see
// VIZ-90); these tests check the module does what that data says, and that what it
// writes works through the real screens' own reads. They change shared rows (a
// caregiver's Verified state, for one), so they run last (playwright.config.ts).

test.describe.configure({ mode: 'serial' })

const PASSWORD = `Seed-${Date.now().toString(36)}-Vf!y`
const svc = () => serviceClient()
const emailOf = (key: string) => ACCOUNTS.find((a) => a.key === key)!.email

function seed(module: string) {
  const result = spawnSync(process.execPath, ['scripts/seed.mjs', '--module', module], {
    encoding: 'utf8',
    env: { ...process.env, SEED_TEST_PASSWORD: PASSWORD },
  })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function summaryOf(stdout: string) {
  return JSON.parse(stdout.slice(stdout.indexOf('{'))) as Record<string, Record<string, number>>
}

async function ids() {
  const profiles = (await svc().from('profiles').select('id, email').in('email', ACCOUNTS.map((a) => a.email))).data ?? []
  return Object.fromEntries(ACCOUNTS.map((a) => [a.key, profiles.find((p) => p.email === a.email)!.id as string]))
}

async function bookingsByKey() {
  const owner = await ids()
  const out: Record<string, { id: string; status: string; caregiver: string | null; assignedBy: string | null; assignedAt: string | null; visit: string }> = {}
  for (const booking of BOOKINGS) {
    const recipient = RECIPIENTS.find((r) => r.key === booking.recipient)!
    const { data: r } = await svc().from('care_recipients').select('id').eq('account_id', owner[recipient.owner]).eq('name', recipient.name).single()
    const { data } = await svc()
      .from('bookings')
      .select('id, status, assigned_caregiver_id, assigned_by, assigned_at, requested_datetime')
      .eq('care_recipient_id', r!.id)
      .eq('bundle_code', booking.bundle)
      .single()
    out[booking.key] = { id: data!.id, status: data!.status, caregiver: data!.assigned_caregiver_id, assignedBy: data!.assigned_by, assignedAt: data!.assigned_at, visit: data!.requested_datetime }
  }
  return out
}

const actionsOf = async (caregiverId: string) =>
  ((await svc().from('caregiver_verifications').select('action, created_at').eq('caregiver_id', caregiverId).order('created_at', { ascending: true })).data ?? []) as { action: string; created_at: string }[]

const last = <T,>(items: T[]) => items[items.length - 1]
const count = async (table: string) => (await svc().from(table).select('id', { count: 'exact', head: true })).count

test.describe('DEV-051 — test seed, verification module', () => {
  test('seeds the history and the assignments as the plan says', async () => {
    const accounts = seed('accounts')
    expect(accounts.status, accounts.stderr).toBe(0)
    const run = seed('verification')
    expect(run.status, run.stderr).toBe(0)

    const owner = await ids()

    // the caregivers' history: Verified, Verified, and Verified-then-removed, written in order
    for (const plan of VERIFICATION) {
      const actions = await actionsOf(owner[plan.caregiver])
      if (plan.state === 'verified') expect(last(actions)?.action, plan.caregiver).toBe('verified')
      if (plan.state === 'removed') {
        expect(actions.slice(-2).map((a) => a.action), plan.caregiver).toEqual(['verified', 'removed'])
        expect(new Date(last(actions)!.created_at).getTime()).toBeGreaterThan(new Date(actions[actions.length - 2].created_at).getTime())
      }
    }
    // and the database's own view of who is Verified now agrees (the Admin's overview)
    const admin = await makeAdmin()
    const overview = await admin.client.from('caregiver_overview').select('id, verified').in('id', ['cg1', 'cg2', 'cg3'].map((k) => owner[k]))
    const verified = Object.fromEntries((overview.data ?? []).map((row) => [row.id, row.verified]))
    expect(verified).toEqual({ [owner.cg1]: true, [owner.cg2]: true, [owner.cg3]: false })

    // the bookings: status, caregiver, who assigned and when, and one assignment row each, as assign_booking leaves them
    const bookings = await bookingsByKey()
    for (const plan of ASSIGNMENTS) {
      const booking = bookings[plan.booking]
      expect(booking.status, plan.booking).toBe(plan.status)
      expect(booking.caregiver, plan.booking).toBe(owner[plan.caregiver])
      expect(booking.assignedBy, plan.booking).toBe(owner.admin1)
      expect(booking.assignedAt, plan.booking).not.toBeNull()
      const rows = (await svc().from('booking_assignments').select('caregiver_id, previous_caregiver_id, assigned_by').eq('booking_id', booking.id)).data ?? []
      expect(rows, plan.booking).toEqual([{ caregiver_id: owner[plan.caregiver], previous_caregiver_id: null, assigned_by: owner.admin1 }])
    }
    // the rest stay requested, so there are always requests left to assign
    for (const key of BOOKINGS.map((b) => b.key).filter((k) => !ASSIGNMENTS.some((a) => a.booking === k))) {
      expect(bookings[key].status, key).toBe('requested')
      expect(bookings[key].caregiver, key).toBeNull()
    }

    // a visit in progress is today, one completed was yesterday (Nairobi time)
    expect(formatTime(bookings.B6.visit)).toBe('09:00 EAT')
    expect(Math.abs(new Date(bookings.B6.visit).getTime() - Date.now())).toBeLessThan(36 * 3600 * 1000)
    expect(formatTime(bookings.B7.visit)).toBe('09:00 EAT')
    expect(Date.now() - new Date(bookings.B7.visit).getTime()).toBeGreaterThan(0)
    expect(Date.now() - new Date(bookings.B7.visit).getTime()).toBeLessThan(48 * 3600 * 1000)
  })

  test('is idempotent: a second run adds nothing, and nothing is deleted', async () => {
    const before = { history: await count('caregiver_verifications'), assignments: await count('booking_assignments') }
    const beforeBookings = await bookingsByKey()
    const run = seed('verification')
    expect(run.status, run.stderr).toBe(0)
    const summary = summaryOf(run.stdout)
    expect(summary.verification.appended).toBe(0)
    expect(summary.assignments.assigned).toBe(0)
    expect(summary.assignments.advanced).toBe(0)
    expect({ history: await count('caregiver_verifications'), assignments: await count('booking_assignments') }).toEqual(before)
    expect(await bookingsByKey()).toEqual(beforeBookings)
  })

  test('the accounts module leaves what the verification module made exactly as it is', async () => {
    const before = await bookingsByKey()
    const run = seed('accounts')
    expect(run.status, run.stderr).toBe(0)
    expect(summaryOf(run.stdout).bookings.left).toBeGreaterThanOrEqual(ASSIGNMENTS.length)
    expect(await bookingsByKey()).toEqual(before)
  })

  test('what it writes works through each role\'s own session', async () => {
    const owner = await ids()
    const signIn = async (key: string) => {
      const client = anonClient()
      const result = await client.auth.signInWithPassword({ email: emailOf(key), password: PASSWORD })
      expect(result.error, key).toBeNull()
      return client
    }
    const bookings = await bookingsByKey()

    // a family sees their caregiver's name while the caregiver is Verified, and not once they are not (state 3)
    const fm1 = await signIn('fm1')
    const mine = await fm1.from('family_bookings').select('id, caregiver_name, caregiver_verified').in('id', [bookings.B1.id, bookings.B2.id])
    expect(Object.fromEntries((mine.data ?? []).map((row) => [row.id, [row.caregiver_name, row.caregiver_verified]]))).toEqual({
      [bookings.B1.id]: ['Caregiver One', true],
      [bookings.B2.id]: ['Caregiver Two', true],
    })
    const fm2 = await signIn('fm2')
    const lost = await fm2.from('family_bookings').select('id, status, caregiver_name, caregiver_verified').in('id', [bookings.B4.id, bookings.B7.id])
    const byId = Object.fromEntries((lost.data ?? []).map((row) => [row.id, row]))
    expect(byId[bookings.B4.id]).toMatchObject({ status: 'assigned', caregiver_name: null, caregiver_verified: false })
    // a finished visit keeps the name, whatever the caregiver's status
    expect(byId[bookings.B7.id]).toMatchObject({ status: 'completed', caregiver_name: 'Caregiver One', caregiver_verified: true })

    // a Verified caregiver reads exactly their own bookings; the one who is no longer Verified reads none
    const readable = async (key: string) => {
      const client = await signIn(key)
      return ((await client.from('bookings').select('id')).data ?? []).map((row) => row.id).sort()
    }
    expect(await readable('cg1')).toEqual([bookings.B1.id, bookings.B7.id].sort())
    expect(await readable('cg2')).toEqual([bookings.B2.id, bookings.B6.id].sort())
    expect(await readable('cg3')).toEqual([])
  })

  test('puts a caregiver back when they have been changed since, adding a row and deleting none', async () => {
    const owner = await ids()
    const admin = await makeAdmin()
    const before = await actionsOf(owner.cg1)

    // the real function removes cg1's Verified status
    const removed = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: owner.cg1, p_note: 'Seed test: removed' })
    expect(removed.error).toBeNull()
    expect(last(await actionsOf(owner.cg1))?.action).toBe('removed')

    const run = seed('verification')
    expect(run.status, run.stderr).toBe(0)
    expect(summaryOf(run.stdout).verification.appended).toBe(1)

    const after = await actionsOf(owner.cg1)
    expect(last(after)?.action).toBe('verified')
    expect(after).toHaveLength(before.length + 2) // the removal and the row that puts them back; nothing deleted
    const overview = await admin.client.from('caregiver_overview').select('verified').eq('id', owner.cg1).single()
    expect(overview.data?.verified).toBe(true)
  })

  test('the admin module is admin1 alone: it restores that one account and writes nothing else', async () => {
    const before = { history: await count('caregiver_verifications'), assignments: await count('booking_assignments'), bookings: await count('bookings'), recipients: await count('care_recipients') }
    const run = seed('admin')
    expect(run.status, run.stderr).toBe(0)
    const summary = summaryOf(run.stdout)
    expect(summary.accounts).toEqual({ created: 0, restored: 1 })
    expect(summary.recipients).toEqual({ created: 0, restored: 0 })
    expect(summary.bookings).toEqual({ created: 0, redated: 0, left: 0 })
    expect({ history: await count('caregiver_verifications'), assignments: await count('booking_assignments'), bookings: await count('bookings'), recipients: await count('care_recipients') }).toEqual(before)
  })
})
