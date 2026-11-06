import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { anonClient, logInViaUI, serviceClient } from './helpers'
import { makeAdmin, makeBooking, makeCaregiver, makeFamily, makeRecipient, makeVisit, nairobiDay, today, type TestBooking, type TestCaregiver, type TestUser } from './factories'
import { getEntries, getVisit, getVisitTasks } from './visit-helpers'

// DEV-062 (FD-VISIT §7.2, §7.4; BR-006; AC-013, AC-014): who can read and write the visit data, by real
// persona sessions and never the service role (which is used only to read the ground truth after an
// attempt). The cases are TC-VIS-015 (every role on the three functions), TC-VIS-038 (Verified removed
// and restored, the screen and the API), TC-VIS-039 (the race between removing Verified and logging),
// TC-VIS-040 (the access matrix of §7.4) and TC-VIS-043 (a started visit cannot be reassigned and
// bookings.status moves only through the functions). The snapshot case, TC-VIS-041, changes the shared
// checklist rows and so has its own file (visit-snapshot.spec.ts).

const TABLES = ['checklist_items', 'visits', 'visit_tasks', 'visit_task_entries'] as const

/** The columns of family_bookings (FD-VERIFY TC-VER-033): unchanged by the visit work. */
const FAMILY_BOOKINGS = ['bundle_code', 'caregiver_name', 'caregiver_verified', 'id', 'recipient_name', 'requested_at', 'requested_datetime', 'status']

const message = (response: { error: { message?: string } | null }) => response.error?.message

async function rowsOf(client: SupabaseClient, table: string, filter?: [string, string]) {
  const query = client.from(table).select('*')
  const { data, error } = await (filter ? query.eq(filter[0], filter[1]) : query)
  return { rows: (data ?? []) as Record<string, unknown>[], error }
}

test.describe('DEV-062 — the access matrix of FD-VISIT 7.4 (TC-VIS-040)', () => {
  test.describe.configure({ mode: 'serial' })

  let F: TestUser, G: TestUser, admin: TestUser
  let A: TestCaregiver, B: TestCaregiver
  let K: TestBooking, kB: TestBooking
  let visitId: string

  test.beforeAll(async () => {
    F = await makeFamily()
    G = await makeFamily()
    admin = await makeAdmin()
    A = await makeCaregiver({ verified: true })
    B = await makeCaregiver({ verified: true })
    const recipient = await makeRecipient({ family: F, careNotes: 'C1-marker: takes insulin at 8am' })
    K = await makeBooking({ family: F, recipient, status: 'assigned', caregiver: A, visit: nairobiDay(today) })
    const visit = await makeVisit({ booking: K, caregiver: A, tasks: [{ key: 'Vitals check', outcome: 'done', note: 'M1-reading: BP 120/80, glucose 6.1' }] })
    visitId = visit.id
    kB = await makeBooking({ family: G, status: 'assigned', caregiver: B })
  })

  /** Every write to the four tables is refused, and the ground truth is as it was. */
  async function expectNoWrites(client: SupabaseClient, who: string) {
    const before = JSON.stringify([await getVisit(K.id), await getVisitTasks(visitId)])
    const task = (await getVisitTasks(visitId)).find((t) => t.task_key === 'vitals_check')!
    const attempts = [
      client.from('checklist_items').insert({ bundle_code: 'medicheck', task_key: 'x', name: 'x', sort_order: 9, is_required: false }),
      client.from('checklist_items').update({ name: 'x' }).eq('task_key', 'no_such_task'),
      client.from('checklist_items').delete().eq('task_key', 'no_such_task'),
      client.from('visits').insert({ booking_id: kB.id, caregiver_id: A.userId, checked_in_at: new Date().toISOString() }),
      client.from('visits').update({ visit_note: 'changed' }).eq('booking_id', K.id),
      client.from('visits').delete().eq('booking_id', K.id),
      client.from('visit_tasks').insert({ visit_id: visitId, task_key: 'x', name: 'x', sort_order: 9, is_required: false, note_required_for_done: false }),
      client.from('visit_tasks').update({ name: 'changed' }).eq('visit_id', visitId),
      client.from('visit_tasks').delete().eq('visit_id', visitId),
      client.from('visit_task_entries').insert({ visit_task_id: task.id, outcome: 'done', logged_by: A.userId, logged_at: new Date().toISOString() }),
      client.from('visit_task_entries').update({ note: 'changed' }).eq('visit_task_id', task.id),
      client.from('visit_task_entries').delete().eq('visit_task_id', task.id),
    ]
    for (const [index, attempt] of attempts.entries()) {
      const response = await attempt
      expect(response.error, `${who}: write ${index} is refused`).not.toBeNull()
    }
    expect(JSON.stringify([await getVisit(K.id), await getVisitTasks(visitId)]), `${who}: nothing changed`).toBe(before)
    expect((await getEntries(task.id)).map((e) => e.note), `${who}: no entry added, changed or removed`).toEqual(['M1-reading: BP 120/80, glucose 6.1'])
  }

  test('A, the assigned Verified caregiver: their own rows through the two views, the checklist, and nothing from the tables', async () => {
    const state = await rowsOf(A.client, 'caregiver_visit', ['booking_id', K.id])
    expect(state.error).toBeNull()
    expect(state.rows).toHaveLength(1)
    const tasks = await rowsOf(A.client, 'caregiver_visit_tasks', ['booking_id', K.id])
    expect(tasks.rows.map((t) => t.task_key)).toEqual(['medication_assistance', 'vitals_check', 'companionship'])
    expect(tasks.rows.find((t) => t.task_key === 'vitals_check')).toMatchObject({ outcome: 'done', note: 'M1-reading: BP 120/80, glucose 6.1' })
    expect((await rowsOf(A.client, 'checklist_items')).rows).toHaveLength(7)
    for (const table of ['visits', 'visit_tasks', 'visit_task_entries']) expect((await rowsOf(A.client, table)).rows, table).toEqual([])
    await expectNoWrites(A.client, 'A')
  })

  test('B, another Verified caregiver: no rows of A\'s booking, from the views or by id', async () => {
    expect((await rowsOf(B.client, 'caregiver_visit', ['booking_id', K.id])).rows).toEqual([])
    expect((await rowsOf(B.client, 'caregiver_visit_tasks', ['booking_id', K.id])).rows).toEqual([])
    expect((await rowsOf(B.client, 'visits', ['id', visitId])).rows).toEqual([])
    expect((await rowsOf(B.client, 'visit_tasks', ['visit_id', visitId])).rows).toEqual([])
    // B reads their own booking and nothing else; the checklist is reference data they may read
    expect((await rowsOf(B.client, 'caregiver_visit')).rows.map((r) => r.booking_id)).toEqual([kB.id])
    expect((await rowsOf(B.client, 'checklist_items')).rows).toHaveLength(7)
    await expectNoWrites(B.client, 'B')
  })

  test('F, the family that owns the booking, and G, another family: nothing from the views or the tables, and no checklist', async () => {
    for (const [label, client] of [['F', F.client], ['G', G.client]] as const) {
      expect((await rowsOf(client, 'caregiver_visit')).rows, `${label} caregiver_visit`).toEqual([])
      expect((await rowsOf(client, 'caregiver_visit_tasks')).rows, `${label} caregiver_visit_tasks`).toEqual([])
      for (const table of TABLES) expect((await rowsOf(client, table)).rows, `${label} ${table}`).toEqual([])
      await expectNoWrites(client, label)
    }
    // family_bookings shows the status only: F sees K as in progress, with exactly the eight columns, and G does not see it
    const mine = await rowsOf(F.client, 'family_bookings', ['id', K.id])
    expect(mine.rows).toHaveLength(1)
    expect(mine.rows[0]).toMatchObject({ status: 'in_progress' })
    expect(Object.keys(mine.rows[0]).sort()).toEqual(FAMILY_BOOKINGS)
    expect((await rowsOf(G.client, 'family_bookings', ['id', K.id])).rows).toEqual([])
    // and none of the caregiver's words is in anything F can read
    expect(JSON.stringify(mine.rows)).not.toContain('M1-')
  })

  test('admin1: SELECT on the four tables in full, notes included; no write; the functions say NOT_CAREGIVER; the views return no rows', async () => {
    expect((await rowsOf(admin.client, 'visits', ['id', visitId])).rows).toHaveLength(1)
    const tasks = await rowsOf(admin.client, 'visit_tasks', ['visit_id', visitId])
    expect(tasks.rows).toHaveLength(3)
    const entries = await rowsOf(admin.client, 'visit_task_entries', ['visit_task_id', String(tasks.rows.find((t) => t.task_key === 'vitals_check')!.id)])
    expect(entries.rows).toHaveLength(1)
    expect(entries.rows[0]).toMatchObject({ note: 'M1-reading: BP 120/80, glucose 6.1', outcome: 'done', logged_by: A.userId })
    expect((await rowsOf(admin.client, 'checklist_items')).rows).toHaveLength(7)
    expect((await rowsOf(admin.client, 'caregiver_visit')).rows).toEqual([])
    expect((await rowsOf(admin.client, 'caregiver_visit_tasks')).rows).toEqual([])
    await expectNoWrites(admin.client, 'admin1')

    expect(message(await admin.client.rpc('check_in', { p_booking_id: K.id }))).toBe('NOT_CAREGIVER')
    expect(message(await admin.client.rpc('log_visit_task', { p_booking_id: K.id, p_task_key: 'companionship', p_outcome: 'done' }))).toBe('NOT_CAREGIVER')
    expect(message(await admin.client.rpc('check_out', { p_booking_id: K.id }))).toBe('NOT_CAREGIVER')
  })

  test('anon: nothing, from the views, the tables or the functions', async () => {
    const anon = anonClient()
    for (const name of ['caregiver_visit', 'caregiver_visit_tasks', ...TABLES]) {
      const result = await rowsOf(anon, name)
      expect(result.error, name).not.toBeNull()
      expect(result.rows, name).toEqual([])
    }
    await expectNoWrites(anon, 'anon')
    for (const [name, args] of [
      ['check_in', { p_booking_id: K.id }],
      ['log_visit_task', { p_booking_id: K.id, p_task_key: 'companionship', p_outcome: 'done' }],
      ['check_out', { p_booking_id: K.id }],
    ] as const) {
      const result = await anon.rpc(name, args)
      expect(result.error?.code, name).toBe('42501')
    }
  })

  test('the test clock and visit_now are not reachable by any role (TC-VIS-045)', async () => {
    for (const client of [A.client, admin.client, F.client, anonClient()]) {
      expect((await client.from('test_clock').select('*')).error).not.toBeNull()
      expect((await client.rpc('visit_now')).error).not.toBeNull()
    }
  })
})

test.describe('DEV-062 — every role on the three functions (TC-VIS-015, §7.3 test 3)', () => {
  test('a family, the Admin and anon are refused, and a Verified stranger, a removed caregiver and an unknown booking all get the same not-found answer', async () => {
    const family = await makeFamily()
    const admin = await makeAdmin()
    const V = await makeCaregiver({ verified: true })
    const W = await makeCaregiver({ verified: true })
    const X = await makeCaregiver({ verified: 'removed' })
    const k1 = await makeBooking({ family, status: 'assigned', caregiver: V, visit: nairobiDay(today) })
    const k2 = await makeBooking({ family, status: 'in_progress', caregiver: V })
    const unknown = '00000000-0000-4000-8000-00000000dead'

    const tasks = await getVisitTasks(k2.visitId!)
    const before = JSON.stringify({ k1: await getVisit(k1.id), k2: await getVisit(k2.id), entries: await getEntries(tasks[0].id) })

    const calls = (id: string, forVisit: boolean) => ({
      check_in: (c: SupabaseClient) => c.rpc('check_in', { p_booking_id: id }),
      log: (c: SupabaseClient) => c.rpc('log_visit_task', { p_booking_id: id, p_task_key: forVisit ? tasks[0].task_key : 'companionship', p_outcome: 'done' }),
      check_out: (c: SupabaseClient) => c.rpc('check_out', { p_booking_id: id }),
    })

    // a family and the Admin: NOT_CAREGIVER on all three; anon: no access at all
    for (const [who, client] of [['family', family.client], ['admin', admin.client]] as const) {
      expect(message(await calls(k1.id, false).check_in(client)), `${who} check_in`).toBe('NOT_CAREGIVER')
      expect(message(await calls(k2.id, true).log(client)), `${who} log_visit_task`).toBe('NOT_CAREGIVER')
      expect(message(await calls(k2.id, true).check_out(client)), `${who} check_out`).toBe('NOT_CAREGIVER')
    }
    for (const [name, call] of [['check_in', calls(k1.id, false).check_in], ['log', calls(k2.id, true).log], ['check_out', calls(k2.id, true).check_out]] as const) {
      expect((await call(anonClient())).error?.code, `anon ${name}`).toBe('42501')
    }

    // W (Verified, not assigned), X (removed) and a booking that does not exist: the same code and message shape
    for (const [who, client] of [['W', W.client], ['X', X.client]] as const) {
      expect(message(await calls(k1.id, false).check_in(client)), `${who} check_in`).toBe('BOOKING_NOT_FOUND')
      expect(message(await calls(k2.id, true).log(client)), `${who} log_visit_task`).toBe('VISIT_NOT_FOUND')
      expect(message(await calls(k2.id, true).check_out(client)), `${who} check_out`).toBe('VISIT_NOT_FOUND')
    }
    for (const client of [W.client, V.client]) {
      expect(message(await calls(unknown, false).check_in(client))).toBe('BOOKING_NOT_FOUND')
      expect(message(await calls(unknown, false).log(client))).toBe('VISIT_NOT_FOUND')
      expect(message(await calls(unknown, false).check_out(client))).toBe('VISIT_NOT_FOUND')
    }

    expect(JSON.stringify({ k1: await getVisit(k1.id), k2: await getVisit(k2.id), entries: await getEntries(tasks[0].id) })).toBe(before)
  })
})

test.describe('DEV-062 — a caregiver whose Verified status is removed mid-visit, and restored (TC-VIS-038)', () => {
  test('the screen is replaced and nothing is stored; the API reads and writes nothing; marked Verified again, the caregiver carries on', async ({ page }) => {
    const admin = await makeAdmin()
    const family = await makeFamily()
    const A = await makeCaregiver({ verified: true })
    const recipient = await makeRecipient({ family, careNotes: 'C1-marker: the medicines are in the blue box' })
    const first = await makeBooking({ family, recipient, status: 'assigned', caregiver: A, visit: nairobiDay(today) })
    await makeVisit({ booking: first, caregiver: A, tasks: [{ key: 'Vitals check', outcome: 'done', note: 'M1-reading: BP 118/76' }] })
    const second = await makeBooking({ family, status: 'assigned', caregiver: A, visit: nairobiDay(today) })
    const visit = (await getVisit(first.id))!
    const medication = (await getVisitTasks(visit.id)).find((t) => t.task_key === 'medication_assistance')!

    // 1. A opens Log task for Medication assistance and types a reason without saving
    await logInViaUI(page, A.email, A.password, '**/assignments')
    await page.goto(`/assignments/${first.id}/tasks/medication_assistance`)
    await page.getByRole('radio', { name: 'Not done', exact: true }).click()
    await page.getByLabel('Reason (required)').fill('Typed but not saved yet')

    // 2. admin1 removes A's Verified status
    expect((await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: A.userId, p_note: 'Reference failed' })).error).toBeNull()

    // 3. A taps Save: the page is replaced by the one message, and the reason is neither shown nor stored
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'This booking is no longer available to you.' })).toBeVisible()
    expect(await getEntries(medication.id)).toEqual([])

    // 4. a reload and My assignments: no checklist, no care notes, no marker anywhere
    for (const url of [`/assignments/${first.id}`, '/assignments']) {
      await page.goto(url)
      const text = await page.locator('body').innerText()
      expect(text, url).not.toContain('C1-marker')
      expect(text, url).not.toContain('M1-reading')
      expect(text, url).not.toContain('Visit checklist')
    }
    await expect(page.getByText('No bookings assigned to you yet.', { exact: false })).toBeVisible()

    // 5. the same session through the API: both views return nothing, and every call is refused with the not-found code
    expect((await rowsOf(A.client, 'caregiver_visit')).rows).toEqual([])
    expect((await rowsOf(A.client, 'caregiver_visit_tasks')).rows).toEqual([])
    expect(message(await A.client.rpc('log_visit_task', { p_booking_id: first.id, p_task_key: 'medication_assistance', p_outcome: 'done' }))).toBe('VISIT_NOT_FOUND')
    expect(message(await A.client.rpc('check_out', { p_booking_id: first.id }))).toBe('VISIT_NOT_FOUND')
    expect(message(await A.client.rpc('check_in', { p_booking_id: first.id }))).toBe('BOOKING_NOT_FOUND')
    expect(message(await A.client.rpc('check_in', { p_booking_id: second.id }))).toBe('BOOKING_NOT_FOUND')

    // 6. the ground truth: still in progress, the visit open, the Vitals entry kept, no new entry
    const status = await serviceClient().from('bookings').select('status').eq('id', first.id).single()
    expect(status.data!.status).toBe('in_progress')
    const after = (await getVisit(first.id))!
    expect(after.checked_out_at).toBeNull()
    expect((await getEntries(medication.id))).toEqual([])
    const vitals = (await getVisitTasks(visit.id)).find((t) => t.task_key === 'vitals_check')!
    expect((await getEntries(vitals.id)).map((e) => e.note)).toEqual(['M1-reading: BP 118/76'])
    expect((await getVisit(second.id))).toBeNull()

    // 7. marked Verified again, A sees the visit with Vitals check Done, and completes it
    expect((await admin.client.rpc('verify_caregiver', { p_caregiver_id: A.userId, p_note: 'Re-checked' })).error).toBeNull()
    await page.goto(`/assignments/${first.id}`)
    await expect(page.getByTestId('visit-task').filter({ hasText: 'Vitals check' })).toContainText('Done')
    expect((await A.client.rpc('log_visit_task', { p_booking_id: first.id, p_task_key: 'medication_assistance', p_outcome: 'done' })).error).toBeNull()
    expect((await A.client.rpc('check_out', { p_booking_id: first.id })).error).toBeNull()
    expect((await getVisit(first.id))!.checked_out_at).not.toBeNull()
  })
})

test.describe('DEV-062 — removing Verified and logging at the same moment (TC-VIS-039, §7.3 test 9)', () => {
  test('20 times: no deadlock, and never an entry stamped after the removal', async () => {
    test.setTimeout(300_000)
    const admin = await makeAdmin()
    for (let round = 1; round <= 20; round += 1) {
      const family = await makeFamily()
      const A = await makeCaregiver({ verified: true })
      const booking = await makeBooking({ family, status: 'in_progress', caregiver: A })
      const visit = (await getVisit(booking.id))!
      const task = (await getVisitTasks(visit.id)).find((t) => t.task_key === 'medication_assistance')!

      const started = Date.now()
      const [removal, log] = await Promise.all([
        admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: A.userId, p_note: `Race ${round}` }),
        A.client.rpc('log_visit_task', { p_booking_id: booking.id, p_task_key: 'medication_assistance', p_outcome: 'done' }),
      ])
      expect(Date.now() - started, `round ${round} finished within a few seconds`).toBeLessThan(10_000)
      expect(removal.error, `round ${round} removal`).toBeNull()

      const entries = await getEntries(task.id)
      const removed = await serviceClient()
        .from('caregiver_verifications')
        .select('created_at')
        .eq('caregiver_id', A.userId)
        .eq('action', 'removed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (log.error) {
        // rejected: the not-found code, and no entry
        expect(log.error.message, `round ${round}`).toBe('VISIT_NOT_FOUND')
        expect(entries, `round ${round}`).toEqual([])
      } else {
        // accepted before the removal committed: an entry exists, stamped earlier than the removal row
        expect(entries, `round ${round}`).toHaveLength(1)
        expect(new Date(entries[0].logged_at).getTime(), `round ${round}`).toBeLessThanOrEqual(new Date(removed.data!.created_at).getTime())
      }
    }
  })
})

test.describe('DEV-062 — a started visit cannot be reassigned and bookings move only through the functions (TC-VIS-043, §7.3 test 12)', () => {
  test('change_booking_caregiver and assign_booking refuse a booking in progress or completed, and no role can PATCH its status or caregiver', async () => {
    const admin = await makeAdmin()
    const family = await makeFamily()
    const A = await makeCaregiver({ verified: true })
    const B = await makeCaregiver({ verified: true })
    const open = await makeBooking({ family, status: 'in_progress', caregiver: A })
    const done = await makeBooking({ family, status: 'completed', caregiver: await makeCaregiver({ verified: true }) })

    const state = async (id: string) => (await serviceClient().from('bookings').select('status, assigned_caregiver_id, assigned_at').eq('id', id).single()).data
    const assignmentRows = async () => (await serviceClient().from('booking_assignments').select('id', { count: 'exact', head: true }).in('booking_id', [open.id, done.id])).count
    const before = { open: await state(open.id), done: await state(done.id), rows: await assignmentRows() }

    // (a) the Admin's functions: BOOKING_NOT_ASSIGNED and BOOKING_NOT_REQUESTED, as in TC-VER-019
    for (const id of [open.id, done.id]) {
      expect(message(await admin.client.rpc('change_booking_caregiver', { p_booking_id: id, p_caregiver_id: B.userId }))).toBe('BOOKING_NOT_ASSIGNED')
      expect(message(await admin.client.rpc('assign_booking', { p_booking_id: id, p_caregiver_id: B.userId }))).toBe('BOOKING_NOT_REQUESTED')
    }

    // (b) PATCH bookings.status and assigned_caregiver_id as the family, the caregiver and the Admin: refused or no row
    for (const [who, client] of [['family', family.client], ['caregiver', A.client], ['admin', admin.client]] as const) {
      for (const id of [open.id, done.id]) {
        for (const patch of [{ status: 'assigned' }, { status: 'in_progress' }, { status: 'completed' }, { assigned_caregiver_id: B.userId }]) {
          const result = await client.from('bookings').update(patch).eq('id', id).select('id')
          const refused = result.error !== null || (result.data ?? []).length === 0
          expect(refused, `${who} PATCH ${JSON.stringify(patch)}`).toBe(true)
        }
      }
    }

    // the booking's status moves only through the three functions: nothing changed
    expect({ open: await state(open.id), done: await state(done.id), rows: await assignmentRows() }).toEqual(before)
  })
})
