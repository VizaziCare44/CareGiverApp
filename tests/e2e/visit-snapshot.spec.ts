import { test, expect } from '@playwright/test'
import { Client } from 'pg'
import { makeBooking, makeCaregiver, makeFamily, nairobiDay, today } from './factories'
import { getChecklistItems, localDbUrl, type ChecklistItemRow } from './visit-helpers'

// DEV-062, TC-VIS-041 (FD-VISIT §7.2, §7.3 test 10; AC-016, FR-015): a visit keeps the checklist it was
// started with. The service-role connection changes the shared checklist_items rows (a rename, a
// Required flag, a removed row), and the open visit, the completed visit and a new visit are read as
// their caregivers. The seven reference rows are put back after the test and found with their original
// values at the end.
//
// It changes rows that every checklist screen reads, so it runs on its own, after every other test
// (playwright.config.ts, the `visit-snapshot` project), and only on the local stack: the clock-style
// direct connection refuses any other host, and the shared dev project carries the UAT data (§12.2
// item 2).

test.describe.configure({ mode: 'serial' })

let local = true
try {
  localDbUrl()
} catch {
  local = false
}
test.skip(!local, 'the checklist rows are changed over a direct database connection, which only the local stack allows')

let original: ChecklistItemRow[] = []

async function withDb<T>(use: (db: Client) => Promise<T>) {
  const db = new Client({ connectionString: localDbUrl() })
  await db.connect()
  try {
    return await use(db)
  } finally {
    await db.end()
  }
}

/** Puts every reference row back exactly as it was read before the test. */
async function restore() {
  await withDb(async (db) => {
    for (const row of original) {
      await db.query(
        `insert into public.checklist_items (bundle_code, task_key, name, sort_order, is_required, note_required_for_done)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (bundle_code, task_key) do update
           set name = excluded.name, sort_order = excluded.sort_order, is_required = excluded.is_required, note_required_for_done = excluded.note_required_for_done`,
        [row.bundle_code, row.task_key, row.name, row.sort_order, row.is_required, row.note_required_for_done],
      )
    }
  })
}

test.beforeAll(async () => {
  original = [...(await getChecklistItems('medicheck')), ...(await getChecklistItems('doctors_day_out'))]
  expect(original).toHaveLength(7)
})

test.afterEach(async () => {
  await restore()
  const now = [...(await getChecklistItems('medicheck')), ...(await getChecklistItems('doctors_day_out'))]
  expect(now, 'the seven reference rows are back with their original values').toEqual(original)
})

test.describe('DEV-062 — a started visit keeps the checklist it started with (TC-VIS-041)', () => {
  test('rename a task, make Companionship Required and remove Vitals check: the open and the completed visit are unchanged, a new one follows the new rows', async () => {
    const family = await makeFamily()
    const A = await makeCaregiver({ verified: true })
    const C = await makeCaregiver({ verified: true })
    const open = await makeBooking({ family, status: 'in_progress', caregiver: A })
    const done = await makeBooking({ family, status: 'completed', caregiver: C })
    const fresh = await makeCaregiver({ verified: true })
    const next = await makeBooking({ family, status: 'assigned', caregiver: fresh, visit: nairobiDay(today) })

    // the rows change, and are committed so the API sees them
    await withDb(async (db) => {
      await db.query('begin')
      await db.query(`update public.checklist_items set name = 'Medication help' where bundle_code = 'medicheck' and task_key = 'medication_assistance'`)
      await db.query(`update public.checklist_items set is_required = true where bundle_code = 'medicheck' and task_key = 'companionship'`)
      await db.query(`delete from public.checklist_items where bundle_code = 'medicheck' and task_key = 'vitals_check'`)
      await db.query('commit')
    })

    // the open and the completed visit still show the original names, flags and order
    const originalShape = [
      { task_key: 'medication_assistance', name: 'Medication assistance', is_required: true, note_required_for_done: false },
      { task_key: 'vitals_check', name: 'Vitals check', is_required: true, note_required_for_done: true },
      { task_key: 'companionship', name: 'Companionship', is_required: false, note_required_for_done: false },
    ]
    const shapeOf = async (caregiver: typeof A, bookingId: string) =>
      ((await caregiver.client.from('caregiver_visit_tasks').select('task_key, name, is_required, note_required_for_done').eq('booking_id', bookingId).order('sort_order')).data ?? [])
    expect(await shapeOf(A, open.id)).toEqual(originalShape)
    expect(await shapeOf(C, done.id)).toEqual(originalShape)

    // and the open one still needs exactly the original Required tasks to check out
    const check = async (taskKey: string, outcome: string, note: string | null) =>
      A.client.rpc('log_visit_task', { p_booking_id: open.id, p_task_key: taskKey, p_outcome: outcome, p_note: note })
    expect((await A.client.rpc('check_out', { p_booking_id: open.id })).error?.message).toBe('REQUIRED_TASKS_MISSING')
    expect((await check('medication_assistance', 'done', null)).error).toBeNull()
    expect((await A.client.rpc('check_out', { p_booking_id: open.id })).error?.message, 'Vitals check is still Required for this visit').toBe('REQUIRED_TASKS_MISSING')
    expect((await check('vitals_check', 'done', 'BP 120/80')).error).toBeNull()
    // Companionship is Required now in the checklist, but not in this visit's snapshot
    expect((await A.client.rpc('check_out', { p_booking_id: open.id })).error).toBeNull()

    // a new visit, started after the change, follows the changed rows
    expect((await fresh.client.rpc('check_in', { p_booking_id: next.id })).error).toBeNull()
    expect(await shapeOf(fresh, next.id)).toEqual([
      { task_key: 'medication_assistance', name: 'Medication help', is_required: true, note_required_for_done: false },
      { task_key: 'companionship', name: 'Companionship', is_required: true, note_required_for_done: false },
    ])
  })
})
