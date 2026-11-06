import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { anonClient, serviceClient } from './helpers'
import { makeAdmin, makeBooking, makeCaregiver, makeFamily, makeRecipient, makeVisit, nairobiDay, today, type TestBooking, type TestCaregiver } from './factories'
import { getVisitTasks } from './visit-helpers'

// DEV-073: the views a family reads a visit through, family_visit and family_visit_tasks (FD-FAMVIS
// §7.2 and §7.4; migration 0018, rebuilt by 0020 and checked against the document on 2026-11-06). Everything here goes through real persona sessions (the family, the caregivers, the
// Admin, anon), never the service role; the service role is used only to set up one hand-made state.

test.describe.configure({ mode: 'serial' })

const FAMILY_VISIT_COLUMNS = ['booking_id', 'checked_in_at', 'checked_out_at', 'visit_note']
const FAMILY_VISIT_TASKS_COLUMNS = ['booking_id', 'logged_at', 'name', 'note', 'outcome', 'reason', 'sort_order']
const REQUIRED_MEDICHECK = ['Medication assistance', 'Vitals check']

interface Scenario {
  family: Awaited<ReturnType<typeof makeFamily>>
  other: Awaited<ReturnType<typeof makeFamily>>
  admin: Awaited<ReturnType<typeof makeAdmin>>
  unassigned: TestCaregiver
  openCg: TestCaregiver
  openBooking: TestBooking
  doneCg: TestCaregiver
  doneBooking: TestBooking
  plainBooking: TestBooking
  handBooking: TestBooking
}
let s: Scenario

const rows = async (client: SupabaseClient, view: string, bookingId?: string) => {
  const query = client.from(view).select('*')
  const { data, error } = await (bookingId ? query.eq('booking_id', bookingId) : query)
  return { rows: (data ?? []) as Record<string, unknown>[], error }
}

async function log(cg: TestCaregiver, bookingId: string, task: string, outcome: 'done' | 'not_done', text: string) {
  const visit = await serviceClient().from('visits').select('id').eq('booking_id', bookingId).single()
  const tasks = await getVisitTasks(visit.data!.id)
  const result = await cg.client.rpc('log_visit_task', {
    p_booking_id: bookingId,
    p_task_key: tasks.find((t) => t.name === task)!.task_key,
    p_outcome: outcome,
    p_note: outcome === 'done' ? text : null,
    p_reason: outcome === 'not_done' ? text : null,
  })
  expect(result.error).toBeNull()
}

test.beforeAll(async () => {
  const family = await makeFamily()
  const recipient = await makeRecipient({ family })
  const [other, admin, unassigned, openCg, doneCg, handCg] = await Promise.all([makeFamily(), makeAdmin(), makeCaregiver({ verified: true }), makeCaregiver({ verified: true }), makeCaregiver({ verified: true }), makeCaregiver({ verified: true })])

  // an open visit, with one task logged Done with a note
  const openBooking = await makeBooking({ family, recipient, status: 'in_progress', caregiver: openCg })
  await log(openCg, openBooking.id, 'Medication assistance', 'done', 'secret-note-open-visit')

  // a finished visit: Medication assistance changed (Not done, then Done), Vitals Done, Companionship Not done
  const doneBooking = await makeBooking({ family, recipient, status: 'assigned', caregiver: doneCg, visit: nairobiDay(today) })
  await makeVisit({
    booking: doneBooking,
    caregiver: doneCg,
    tasks: [
      { key: 'Medication assistance', outcome: 'not_done', reason: 'The tablets had not arrived' },
      { key: 'Medication assistance', outcome: 'done', note: 'Gave them after lunch' },
      { key: 'Vitals check', outcome: 'done', note: 'BP 120/80, glucose 6.1' },
      { key: 'Companionship', outcome: 'not_done', reason: 'She was resting' },
    ],
    closed: true,
    visitNote: 'A quiet visit',
  })

  // another finished visit of the same family, Companionship (Optional) never logged
  const plainBooking = await makeBooking({ family, recipient, status: 'assigned', caregiver: doneCg, visit: nairobiDay(today) })
  await makeVisit({ booking: plainBooking, caregiver: doneCg, closed: true })

  // a booking set to completed by hand, its visit still open
  const handBooking = await makeBooking({ family, recipient, status: 'in_progress', caregiver: handCg })
  const hand = await serviceClient().from('bookings').update({ status: 'completed' }).eq('id', handBooking.id)
  expect(hand.error).toBeNull()

  s = { family, other, admin, unassigned, openCg, openBooking, doneCg, doneBooking, plainBooking, handBooking }
})

test.describe('DEV-073 — the owner of an in-progress booking', () => {
  test('gets the check-in time and no closing time, no note and no task row', async () => {
    const visit = await rows(s.family.client, 'family_visit', s.openBooking.id)
    expect(visit.error).toBeNull()
    expect(visit.rows).toHaveLength(1)
    expect(visit.rows[0].checked_in_at).toBeTruthy()
    expect(visit.rows[0].checked_out_at).toBeNull()
    expect(visit.rows[0].visit_note).toBeNull()
    expect((await rows(s.family.client, 'family_visit_tasks', s.openBooking.id)).rows).toEqual([])
  })

  test('a request that adds a filter on the note returns nothing extra', async () => {
    const byNote = await s.family.client.from('family_visit_tasks').select('*').eq('booking_id', s.openBooking.id).ilike('note', '%secret%')
    expect(byNote.data ?? []).toEqual([])
    const anyNote = await s.family.client.from('family_visit_tasks').select('*').ilike('note', '%secret-note-open-visit%')
    expect(anyNote.data ?? []).toEqual([])
    const byVisitNote = await s.family.client.from('family_visit').select('*').eq('booking_id', s.openBooking.id).not('visit_note', 'is', null)
    expect(byVisitNote.data ?? []).toEqual([])
    // and the open visit's Done note is in no row the family can read at all
    expect(JSON.stringify((await rows(s.family.client, 'family_visit_tasks')).rows)).not.toContain('secret-note-open-visit')
  })

  test('a booking set to completed by hand without a closed visit returns no check-out time and no tasks', async () => {
    const visit = await rows(s.family.client, 'family_visit', s.handBooking.id)
    expect(visit.rows).toHaveLength(1)
    expect(visit.rows[0].checked_in_at).toBeTruthy()
    expect(visit.rows[0].checked_out_at).toBeNull()
    expect(visit.rows[0].visit_note).toBeNull()
    expect((await rows(s.family.client, 'family_visit_tasks', s.handBooking.id)).rows).toEqual([])
  })
})

test.describe('DEV-073 — after check-out the owner gets everything (AC-007)', () => {
  test('family_visit: both times and the note about the visit', async () => {
    const visit = await rows(s.family.client, 'family_visit', s.doneBooking.id)
    expect(visit.rows).toHaveLength(1)
    expect(visit.rows[0].checked_in_at).toBeTruthy()
    expect(visit.rows[0].checked_out_at).toBeTruthy()
    expect(new Date(visit.rows[0].checked_out_at as string).getTime()).toBeGreaterThanOrEqual(new Date(visit.rows[0].checked_in_at as string).getTime())
    expect(visit.rows[0].visit_note).toBe('A quiet visit')
  })

  test('family_visit_tasks: one row per task in order, with outcome, reason, note and time', async () => {
    const tasks = (await rows(s.family.client, 'family_visit_tasks', s.doneBooking.id)).rows.sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
    expect(tasks.map((t) => t.name)).toEqual(['Medication assistance', 'Vitals check', 'Companionship'])
    expect(tasks.map((t) => t.outcome)).toEqual(['done', 'done', 'not_done'])
    expect(tasks.every((t) => typeof t.logged_at === 'string')).toBe(true)
  })

  test('a changed task returns one row with the latest entry', async () => {
    const medication = (await rows(s.family.client, 'family_visit_tasks', s.doneBooking.id)).rows.filter((t) => t.name === 'Medication assistance')
    expect(medication).toHaveLength(1)
    expect(medication[0]).toMatchObject({ outcome: 'done', note: 'Gave them after lunch', reason: null })
  })

  test('a Not done task returns its reason and no note; a Done task returns its note and no reason', async () => {
    const tasks = (await rows(s.family.client, 'family_visit_tasks', s.doneBooking.id)).rows
    expect(tasks.find((t) => t.name === 'Companionship')).toMatchObject({ outcome: 'not_done', reason: 'She was resting', note: null })
    expect(tasks.find((t) => t.name === 'Vitals check')).toMatchObject({ outcome: 'done', note: 'BP 120/80, glucose 6.1', reason: null })
  })

  test('an Optional task with no entry is not_recorded, with no time; no Required task ever is', async () => {
    const tasks = (await rows(s.family.client, 'family_visit_tasks', s.plainBooking.id)).rows
    expect(tasks).toHaveLength(3)
    expect(tasks.find((t) => t.name === 'Companionship')).toMatchObject({ outcome: 'not_recorded', logged_at: null, reason: null, note: null })
    for (const name of REQUIRED_MEDICHECK) expect(tasks.find((t) => t.name === name)!.outcome, name).toBe('done')
    // across everything the family can read
    const all = (await rows(s.family.client, 'family_visit_tasks')).rows
    expect(all.filter((t) => t.outcome === 'not_recorded').every((t) => !REQUIRED_MEDICHECK.includes(t.name as string))).toBe(true)
  })

  test('a closed visit with a Required task not logged (hand-made) gives one row per task, as FD-FAMVIS 7.2 says: the unlogged ones are not_recorded', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const booking = await makeBooking({ family, status: 'in_progress', caregiver })
    const closed = await serviceClient().from('visits').update({ checked_out_at: new Date(Date.now() + 1000).toISOString() }).eq('booking_id', booking.id)
    expect(closed.error).toBeNull()
    expect((await serviceClient().from('bookings').update({ status: 'completed' }).eq('id', booking.id)).error).toBeNull()
    expect((await rows(family.client, 'family_visit', booking.id)).rows).toHaveLength(1)
    // check_out never lets this happen (REQUIRED_TASKS_MISSING) and the probe lists it (REQUIRED_TASK_NOT_LOGGED); the view does not hide it
    const tasks = (await rows(family.client, 'family_visit_tasks', booking.id)).rows
    expect(tasks).toHaveLength(3)
    expect(tasks.every((t) => t.outcome === 'not_recorded')).toBe(true)
  })
})

test.describe('DEV-073 — nobody else gets rows (AC-008)', () => {
  for (const [label, who] of [
    ['another family', () => s.other.client],
    ['an unassigned caregiver', () => s.unassigned.client],
    ['the caregiver assigned to the open visit', () => s.openCg.client],
    ['the caregiver assigned to the finished visits', () => s.doneCg.client],
    ['the Admin', () => s.admin.client],
  ] as const) {
    test(`${label} gets no rows from either view`, async () => {
      for (const view of ['family_visit', 'family_visit_tasks']) {
        const result = await rows(who(), view)
        expect(result.error, `${label} ${view}`).toBeNull()
        expect(result.rows, `${label} ${view}`).toEqual([])
      }
      // and not by asking for the booking by id
      for (const booking of [s.openBooking, s.doneBooking]) {
        expect((await rows(who(), 'family_visit', booking.id)).rows).toEqual([])
        expect((await rows(who(), 'family_visit_tasks', booking.id)).rows).toEqual([])
      }
    })
  }

  test('anon is refused', async () => {
    for (const view of ['family_visit', 'family_visit_tasks']) {
      const result = await rows(anonClient(), view)
      expect(result.rows, view).toEqual([])
      expect(result.error, view).not.toBeNull()
    }
  })

  test('the family has no way to read the visit tables themselves', async () => {
    for (const table of ['visits', 'visit_tasks', 'visit_task_entries', 'checklist_items']) {
      const result = await s.family.client.from(table).select('*')
      expect(result.data ?? [], table).toEqual([])
    }
  })
})

test.describe('DEV-073 — the exact column lists', () => {
  test('family_visit', async () => {
    const visit = await rows(s.family.client, 'family_visit', s.doneBooking.id)
    expect(Object.keys(visit.rows[0]).sort()).toEqual(FAMILY_VISIT_COLUMNS)
  })

  test('family_visit_tasks (no is_required, no task, visit or entry id, no earlier entry)', async () => {
    const tasks = await rows(s.family.client, 'family_visit_tasks', s.doneBooking.id)
    for (const task of tasks.rows) expect(Object.keys(task).sort()).toEqual(FAMILY_VISIT_TASKS_COLUMNS)
    expect(JSON.stringify(tasks.rows)).not.toContain('The tablets had not arrived')
  })
})
