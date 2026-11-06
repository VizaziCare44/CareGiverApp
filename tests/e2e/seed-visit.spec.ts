import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { formatDate, formatTime } from '../../lib/datetime'
import { ACCOUNTS, BOOKINGS, RECIPIENTS, VISITS, LONG_CARE_NOTE_LENGTH, occurrence } from '../../scripts/seed/starter-set.mjs'
import { anonClient, serviceClient } from './helpers'
import { nairobiDay } from './factories'
import { countClockRows, getChecklistItems, getEntries, getVisit, getVisitTasks, probe } from './visit-helpers'

// DEV-070 item 1 (and items 4 and 6 for the starter set): the visit module of the test seed, run for
// real through `npm run seed`: B6 open with cg2 and partly logged, B7 closed with cg1 and fully
// logged, in the past in Nairobi, every time inside the booked day, and the probe passing. The data
// it writes is VISITS in scripts/seed/starter-set.mjs (Test_Data_Strategy.md §3.3 and §7, checked 2026-11-06, VIZ-90). Like the other seed
// tests it changes shared rows, so it runs after every other test (playwright.config.ts) — which is
// also why it is where the test clock is counted at the end of the suite (TC-VIS-045).

test.describe.configure({ mode: 'serial' })

const PASSWORD = `Seed-${Date.now().toString(36)}-Vs!y`
const svc = () => serviceClient()
const emailOf = (key: string) => ACCOUNTS.find((a) => a.key === key)!.email

function seed(module: string) {
  const result = spawnSync(process.execPath, ['scripts/seed.mjs', '--module', module], {
    encoding: 'utf8',
    env: { ...process.env, SEED_TEST_PASSWORD: PASSWORD },
  })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

const summaryOf = (stdout: string) => JSON.parse(stdout.slice(stdout.indexOf('{'))) as Record<string, Record<string, number>>

async function ids() {
  const profiles = (await svc().from('profiles').select('id, email').in('email', ACCOUNTS.map((a) => a.email))).data ?? []
  return Object.fromEntries(ACCOUNTS.map((a) => [a.key, profiles.find((p) => p.email === a.email)!.id as string]))
}

async function bookingOf(key: string) {
  const owner = await ids()
  const def = BOOKINGS.find((b) => b.key === key)!
  const recipient = RECIPIENTS.find((r) => r.key === def.recipient)!
  const { data: r } = await svc().from('care_recipients').select('id').eq('account_id', owner[recipient.owner]).eq('name', recipient.name).single()
  const { data: rows } = await svc()
    .from('bookings')
    .select('id, status, bundle_code, requested_datetime, assigned_caregiver_id')
    .eq('care_recipient_id', r!.id)
    .eq('bundle_code', def.bundle)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  // B6 and B7 share a recipient and a bundle: the order they were created in tells them apart
  return rows![occurrence(def)]
}

const count = async (table: string) => (await svc().from(table).select('*', { count: 'exact', head: true })).count

test.describe('DEV-070 — test seed, visit module', () => {
  test('seeds B6 open and partly logged, B7 closed and fully logged, and the probe passes', async () => {
    for (const module of ['accounts', 'verification', 'visit']) {
      const run = seed(module)
      expect(run.status, `${module}: ${run.stderr}`).toBe(0)
    }
    const owner = await ids()

    const b6 = await bookingOf('B6')
    const b7 = await bookingOf('B7')
    expect(b6.status).toBe('in_progress')
    expect(b7.status).toBe('completed')

    // B6: the visit is cg2's and open; its tasks are the bundle's checklist as it is now
    const v6 = (await getVisit(b6.id))!
    expect(v6.caregiver_id).toBe(owner.cg2)
    expect(v6.checked_out_at).toBeNull()
    const tasks6 = await getVisitTasks(v6.id)
    const checklist6 = await getChecklistItems('medicheck')
    expect(tasks6.map((t) => [t.task_key, t.name, t.is_required, t.note_required_for_done, t.sort_order])).toEqual(checklist6.map((i) => [i.task_key, i.name, i.is_required, i.note_required_for_done, i.sort_order]))

    // Medication assistance: Done, after one earlier entry was changed (the history has both)
    const medication = await getEntries(tasks6.find((t) => t.name === 'Medication assistance')!.id)
    expect(medication.map((e) => e.outcome)).toEqual(['not_done', 'done'])
    expect(medication[0].reason).toBe('The tablets had not been delivered yet.')
    expect(medication[1].note).toBe('Gave the morning tablets with water once they arrived.')
    // the Required task left unlogged is Vitals check; Companionship has no entry either
    expect(await getEntries(tasks6.find((t) => t.name === 'Vitals check')!.id)).toEqual([])
    expect(await getEntries(tasks6.find((t) => t.name === 'Companionship')!.id)).toEqual([])

    // B7: cg1's, closed, a note about the visit, an entry for every task
    const v7 = (await getVisit(b7.id))!
    expect(v7.caregiver_id).toBe(owner.cg1)
    expect(v7.checked_out_at).not.toBeNull()
    expect(v7.visit_note).toBe('A calm morning; she ate well and asked for the radio.')
    const tasks7 = await getVisitTasks(v7.id)
    // B7 is MediCheck as well (Test_Data_Strategy.md §3.3): its three tasks, each with an entry
    expect(tasks7.map((t) => t.name)).toEqual((await getChecklistItems('medicheck')).map((i) => i.name))
    for (const task of tasks7) expect((await getEntries(task.id)).length, task.name).toBeGreaterThanOrEqual(1)

    // dated in the past in Nairobi, and every time inside the booked day (Nairobi)
    for (const [key, booking, visit, tasks] of [['B6', b6, v6, tasks6], ['B7', b7, v7, tasks7]] as const) {
      const day = formatDate(booking.requested_datetime)
      expect(new Date(booking.requested_datetime).getTime(), key).toBeLessThan(Date.now())
      // one or two days back (three, if the seed ran just before Nairobi midnight)
      expect([-1, -2, -3].some((offset) => formatDate(nairobiDay(offset)) === day), `${key} is in the past, on a day before today`).toBe(true)
      const times = [visit.checked_in_at, visit.checked_out_at].filter((t): t is string => t !== null)
      for (const task of tasks) for (const entry of await getEntries(task.id)) times.push(entry.logged_at)
      for (const time of times) {
        expect(formatDate(time), `${key} ${time}`).toBe(day)
        expect(new Date(time).getTime(), `${key} ${time}`).toBeLessThan(Date.now())
      }
    }
    expect(formatTime(v6.checked_in_at)).toBe('09:05 EAT')
    expect(formatTime(v7.checked_out_at!)).toBe('12:15 EAT')

    // the probe of §7.3 item 13 passes for what the seed wrote
    expect(await probe({ bookingIds: [b6.id, b7.id] })).toEqual([])
  })

  test('is idempotent: a second run adds nothing and changes nothing', async () => {
    const before = { visits: await count('visits'), tasks: await count('visit_tasks'), entries: await count('visit_task_entries') }
    const b6 = await bookingOf('B6')
    const b7 = await bookingOf('B7')
    const rows = async () => [await getVisit(b6.id), await getVisit(b7.id)]
    const visitsBefore = await rows()

    const run = seed('visit')
    expect(run.status, run.stderr).toBe(0)
    const summary = summaryOf(run.stdout)
    expect(summary.visits.created).toBe(0)
    expect(summary.visits.entries).toBe(0)
    expect(summary.visits.left).toBe(VISITS.length)
    expect({ visits: await count('visits'), tasks: await count('visit_tasks'), entries: await count('visit_task_entries') }).toEqual(before)
    expect(await rows()).toEqual(visitsBefore)
  })

  test('puts a booking status right and adds nothing else', async () => {
    const b6 = await bookingOf('B6')
    const before = await count('visit_task_entries')
    expect((await svc().from('bookings').update({ status: 'assigned' }).eq('id', b6.id)).error).toBeNull()
    const run = seed('visit')
    expect(run.status, run.stderr).toBe(0)
    expect(summaryOf(run.stdout).statuses.corrected).toBe(1)
    expect((await bookingOf('B6')).status).toBe('in_progress')
    expect(await count('visit_task_entries')).toBe(before)
  })

  test('what it writes works through each caregiver\'s own session', async () => {
    const signIn = async (key: string) => {
      const client = anonClient()
      const result = await client.auth.signInWithPassword({ email: emailOf(key), password: PASSWORD })
      expect(result.error, key).toBeNull()
      return client
    }
    const b6 = await bookingOf('B6')
    const b7 = await bookingOf('B7')

    // cg2 sees the open visit: Medication assistance Done (the entry that counts), the Required Vitals check not logged
    const cg2 = await signIn('cg2')
    const open = (await cg2.from('caregiver_visit_tasks').select('name, is_required, outcome, note').eq('booking_id', b6.id).order('sort_order')).data ?? []
    expect(open).toEqual([
      { name: 'Medication assistance', is_required: true, outcome: 'done', note: 'Gave the morning tablets with water once they arrived.' },
      { name: 'Vitals check', is_required: true, outcome: null, note: null },
      { name: 'Companionship', is_required: false, outcome: null, note: null },
    ])

    // cg1 sees B7 finished: every task has its outcome
    const cg1 = await signIn('cg1')
    const done = (await cg1.from('caregiver_visit_tasks').select('name, outcome').eq('booking_id', b7.id).order('sort_order')).data ?? []
    expect(done.map((t) => t.outcome)).toEqual(['done', 'done', 'done'])

    // and the family of B7 (fm4) reads the booking as completed with the caregiver's name
    const family = await signIn('fm4')
    const view = await family.from('family_bookings').select('id, status, caregiver_name').eq('id', b7.id).single()
    expect(view.data).toMatchObject({ status: 'completed', caregiver_name: 'Test Caregiver 1' })
  })

  test('recipient 4A\'s care note is stored at exactly 2,000 characters (item 4)', async () => {
    const recipient = RECIPIENTS.find((r) => r.key === '4A')!
    const { data } = await svc().from('care_recipients').select('care_notes').eq('name', recipient.name).single()
    expect(data!.care_notes).toHaveLength(LONG_CARE_NOTE_LENGTH)
    expect(data!.care_notes).toBe(recipient.careNotes)
  })

  test('the starter dates: B3, B4 and B5 are 3 Nairobi days after the day of seeding, so always before the visit day (item 6)', async () => {
    for (const [key, time] of [['B3', '09:00'], ['B4', '11:00'], ['B5', '14:00']] as const) {
      const booking = await bookingOf(key)
      expect(formatDate(booking.requested_datetime), key).toBe(formatDate(nairobiDay(3, time)))
      expect(formatTime(booking.requested_datetime), key).toBe(`${time} EAT`)
    }
  })

  test('no test clock is left behind at the end of the suite (TC-VIS-045)', async () => {
    expect(await countClockRows()).toBe(0)
  })
})
