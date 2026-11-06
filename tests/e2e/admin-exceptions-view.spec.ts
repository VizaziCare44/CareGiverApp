import { test, expect } from '@playwright/test'
import { anonClient } from './helpers'
import { makeBooking, makeFamily, makeRecipient, nairobiDay, today } from './factories'
import {
  asCaregiverAt,
  checkInAt,
  exceptionsFor,
  exceptionsLocal,
  flagsOf,
  hours,
  makeExceptionAdmin,
  makeExceptionBooking,
  minutes,
  plus,
  removeVerified,
  setStatus,
  type ExceptionAdmin,
} from './exceptions-data'

// DEV-079 (FD-ADMINEXC §3, §5, §9): the Admin's exceptions view, at API level with real persona sessions
// (Q4): the Admin reads it with their own session and the test clock is that Admin's own row, set to the
// second on the local stack. A case per exception and edge. The structure, grants and boundaries are also
// checked on the database itself (backend-config 0019_admin_exceptions.test.sql). The screen is
// admin-exceptions-screen.spec.ts. The setting-changing case (AC-020) changes a shared table, so it runs on its
// own in admin-exceptions-settings.spec.ts.

test.skip(!exceptionsLocal, 'the boundary cases need the test clock, which only the local stack allows; on any other project they are not covered')

const COLUMNS = [
  'booking_id',
  'requested_datetime',
  'bundle_code',
  'recipient_name',
  'caregiver_name',
  'status',
  'e1_no_check_in',
  'e2_late_check_in',
  'e3_check_out_outstanding',
  'e4_required_task_not_done',
  'e5_caregiver_not_verified',
  'e6_visit_record_missing',
  'minutes_since_requested',
  'minutes_late',
  'minutes_since_check_in',
  'not_done_tasks',
]

/** The visit time every case is built around: 09:00 in Nairobi today. */
const requestedAt = () => nairobiDay(today, '09:00')

let admins: ExceptionAdmin[] = []
async function newAdmin() {
  const admin = await makeExceptionAdmin()
  admins.push(admin)
  return admin
}
test.afterEach(async () => {
  await Promise.all(admins.map((admin) => admin.clearNow()))
  admins = []
})

test.describe('DEV-079 — who can read the view, and what it returns', () => {
  test('AC-001, AC-010, AC-015: only an Admin gets rows; nobody can write; exactly the sixteen columns and no note, phone or id', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R, careNotes: 'C1-marker: takes insulin at 8am' })
    await admin.setNow(plus(R, minutes(45)))

    const rows = await exceptionsFor(admin, b.id)
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0]).sort()).toEqual([...COLUMNS].sort())
    const text = JSON.stringify(rows[0])
    for (const forbidden of ['C1-marker', '+254', 'phone', 'care_notes', 'visit_note', 'caregiver_id', 'visit_id']) expect(text, forbidden).not.toContain(forbidden)

    // a family, a caregiver and a non-Admin session get an empty list; anon is refused
    for (const [who, client] of [['the family', b.family.client], ['the caregiver', b.caregiver.client]] as const) {
      expect(await exceptionsFor({ client }, b.id), who).toEqual([])
      expect((await client.from('admin_exceptions').select('*')).data ?? [], `${who} sees no row at all`).toEqual([])
    }
    const anon = await anonClient().from('admin_exceptions').select('*')
    expect(anon.error).not.toBeNull()

    // no role writes
    for (const [who, client] of [['admin', admin.client], ['family', b.family.client], ['caregiver', b.caregiver.client], ['anon', anonClient()]] as const) {
      expect((await client.from('admin_exceptions').insert({ booking_id: b.id })).error, `${who} insert`).not.toBeNull()
      expect((await client.from('admin_exceptions').update({ recipient_name: 'x' }).eq('booking_id', b.id)).error, `${who} update`).not.toBeNull()
      expect((await client.from('admin_exceptions').delete().eq('booking_id', b.id)).error, `${who} delete`).not.toBeNull()
    }
    // the settings are closed to every API role
    expect((await admin.client.from('exception_settings').select('*')).error).not.toBeNull()
  })
})

test.describe('DEV-079 — E1, no check-in (AC-002, AC-017, AC-021)', () => {
  test('exactly 30 minutes: no row; 30:01 and later: a row that reads whole minutes rounded down; a time still ahead: never', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    const at = async (offset: number) => {
      await admin.setNow(plus(R, offset))
      return exceptionsFor(admin, b.id)
    }

    expect(await at(-minutes(5)), 'the requested time is still ahead').toEqual([])
    expect(await at(0), 'at the requested time').toEqual([])
    expect(await at(minutes(30)), 'exactly 30 minutes and 0 seconds').toEqual([])

    let rows = await at(minutes(30) + 1000)
    expect(rows.map(flagsOf), '30 minutes and 1 second').toEqual([['e1']])
    expect(rows[0].minutes_since_requested, 'reads 30, rounded down').toBe(30)
    rows = await at(minutes(30) + 59_000)
    expect(rows[0].minutes_since_requested, '30:59 still reads 30').toBe(30)
    rows = await at(minutes(31))
    expect(rows[0].minutes_since_requested).toBe(31)

    // the other two minutes columns are null unless their own flag is true
    expect(rows[0].minutes_late).toBeNull()
    expect(rows[0].minutes_since_check_in).toBeNull()
    expect(rows[0].status).toBe('assigned')
    expect(rows[0].recipient_name).toBe(b.recipientName)
    expect(rows[0].caregiver_name).toBe(b.caregiver.fullName)
  })

  test('the exact minutes are returned for the span cases: 119 and 120 minutes, 47 and 48 hours, 71 hours (AC-016 at the database)', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    for (const [offset, minutesExpected] of [
      [minutes(119), 119],
      [minutes(120), 120],
      [hours(47), 2820],
      [hours(48), 2880],
      [hours(71), 4260],
    ] as const) {
      await admin.setNow(plus(R, offset))
      const rows = await exceptionsFor(admin, b.id)
      expect(rows[0]?.minutes_since_requested, `${offset / 60000} minutes in`).toBe(minutesExpected)
    }
  })
})

test.describe('DEV-079 — E2, late check-in (AC-003, AC-017, AC-018)', () => {
  test('checked in exactly 30 minutes after: on time; 30:01 and 31 minutes: a row, with E1 never in it', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const onTime = await makeExceptionBooking({ requested: R })
    const late = await makeExceptionBooking({ requested: R })
    const later = await makeExceptionBooking({ requested: R })
    await checkInAt(onTime, plus(R, minutes(30)))
    await checkInAt(late, plus(R, minutes(30) + 1000))
    await checkInAt(later, plus(R, minutes(31)))
    await admin.setNow(plus(R, hours(1)))

    expect(await exceptionsFor(admin, onTime.id), 'exactly 30 minutes and 0 seconds').toEqual([])
    const rows = await exceptionsFor(admin, late.id, later.id)
    const byId = Object.fromEntries(rows.map((row) => [row.booking_id, row]))
    expect(flagsOf(byId[late.id])).toEqual(['e2'])
    expect(byId[late.id].minutes_late, '30:01 reads 30').toBe(30)
    expect(flagsOf(byId[later.id])).toEqual(['e2'])
    expect(byId[later.id].minutes_late).toBe(31)
    expect(byId[later.id].minutes_since_requested, 'E1 is null when E1 is false').toBeNull()
    expect(rows.some((row) => row.e1_no_check_in), 'E1 and E2 are never in one row').toBe(false)
    expect(byId[late.id].status).toBe('in_progress')
  })
})

test.describe('DEV-079 — E3, check-out outstanding (AC-004)', () => {
  test('an open visit shows once it is more than 8 hours old, not at exactly 8 hours, and clears when it is checked out', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    const checkedIn = plus(R, minutes(5))
    await checkInAt(b, checkedIn)
    const at = async (offset: number) => {
      await admin.setNow(plus(checkedIn, offset))
      return exceptionsFor(admin, b.id)
    }

    expect(await at(hours(1))).toEqual([])
    expect(await at(hours(8)), 'exactly 8 hours').toEqual([])
    let rows = await at(hours(8) + 1000)
    expect(rows.map(flagsOf)).toEqual([['e3']])
    expect(rows[0].minutes_since_check_in, '8 hours and a second reads 480').toBe(480)
    rows = await at(hours(8) + minutes(1))
    expect(rows[0].minutes_since_check_in).toBe(481)

    // the caregiver logs the Required tasks and checks out: the exception clears itself (R-01)
    const closeAt = plus(checkedIn, hours(8) + minutes(2))
    expect((await asCaregiverAt(b, closeAt, (c) => c.rpc('log_visit_task', { p_booking_id: b.id, p_task_key: 'medication_assistance', p_outcome: 'done' }))).error).toBeNull()
    expect((await asCaregiverAt(b, closeAt, (c) => c.rpc('log_visit_task', { p_booking_id: b.id, p_task_key: 'vitals_check', p_outcome: 'done', p_note: 'BP 120/80' }))).error).toBeNull()
    expect((await asCaregiverAt(b, closeAt, (c) => c.rpc('check_out', { p_booking_id: b.id }))).error).toBeNull()
    expect(await at(hours(9))).toEqual([])
  })
})

test.describe('DEV-079 — E4, a Required task not done (AC-005, AC-014)', () => {
  test('the task name and its reason, in checklist order; the reason is plain data; no note and no visit note', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R, bundle: 'doctors_day_out', careNotes: 'C1-marker care note' })
    const script = 'Cancelled <script>window.__x=1</script> see https://example.test/a?b=c'
    await checkInAt(b, plus(R, minutes(5)), {
      tasks: [
        { key: 'Advocacy and note-taking', outcome: 'not_done', reason: 'Line one\nLine two' },
        { key: 'Transport and escort', outcome: 'not_done', reason: script },
        { key: 'Pre-visit preparation', outcome: 'not_done', reason: 'Optional: not shown' },
        { key: 'Post-visit summary', outcome: 'done', note: 'secret-summary-note' },
      ],
      closed: true,
      visitNote: 'secret-visit-note',
    })
    await admin.setNow(plus(R, hours(2)))

    const rows = await exceptionsFor(admin, b.id)
    expect(rows.map(flagsOf)).toEqual([['e4']])
    // checklist order: Transport and escort comes before Advocacy and note-taking
    expect(rows[0].not_done_tasks).toEqual([
      { name: 'Transport and escort', reason: script },
      { name: 'Advocacy and note-taking', reason: 'Line one\nLine two' },
    ])
    const text = JSON.stringify(rows)
    for (const forbidden of ['secret-summary-note', 'secret-visit-note', 'C1-marker', 'Optional: not shown']) expect(text, forbidden).not.toContain(forbidden)
  })

  test('corrected to Done: no row; an Optional task Not done: no row; a task logged Done: no row', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const corrected = await makeExceptionBooking({ requested: R })
    const optional = await makeExceptionBooking({ requested: R })
    const plain = await makeExceptionBooking({ requested: R })
    await checkInAt(corrected, plus(R, minutes(5)), {
      tasks: [
        { key: 'Medication assistance', outcome: 'not_done', reason: 'Refused at first' },
        { key: 'Medication assistance', outcome: 'done', note: 'Took them an hour later' },
      ],
      closed: true,
    })
    await checkInAt(optional, plus(R, minutes(5)), { tasks: [{ key: 'Companionship', outcome: 'not_done', reason: 'She was resting' }], closed: true })
    await checkInAt(plain, plus(R, minutes(5)), { closed: true })
    await admin.setNow(plus(R, hours(2)))
    expect(await exceptionsFor(admin, corrected.id, optional.id, plain.id)).toEqual([])
  })
})

test.describe('DEV-079 — E5, the caregiver is no longer Verified (AC-006, AC-021)', () => {
  test('an open visit whose caregiver loses Verified shows E5; a closed visit does not', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const open = await makeExceptionBooking({ requested: R })
    const closed = await makeExceptionBooking({ requested: R })
    await checkInAt(open, plus(R, minutes(5)))
    await checkInAt(closed, plus(R, minutes(5)), { closed: true })
    await admin.setNow(plus(R, hours(1)))
    expect(await exceptionsFor(admin, open.id, closed.id), 'both caregivers are Verified').toEqual([])

    await removeVerified(admin, open.caregiver)
    await removeVerified(admin, closed.caregiver)
    const rows = await exceptionsFor(admin, open.id, closed.id)
    expect(rows.map((row) => [row.booking_id, ...flagsOf(row)])).toEqual([[open.id, 'e5']])
    expect(rows[0].caregiver_name).toBe(open.caregiver.fullName)
    expect(rows[0].status).toBe('in_progress')
  })

  test('an early check-in shows E5 from the check-in, before the requested time (decision 11, AC-021)', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    const early = plus(R, -minutes(30))
    await checkInAt(b, early)
    await admin.setNow(plus(R, -minutes(20)))
    expect(await exceptionsFor(admin, b.id), 'Verified and checked in early: nothing').toEqual([])

    await removeVerified(admin, b.caregiver)
    const rows = await exceptionsFor(admin, b.id)
    expect(rows.map(flagsOf)).toEqual([['e5']])
    expect(rows[0].minutes_late, 'an early check-in is not late').toBeNull()
  })
})

test.describe('DEV-079 — E6, the visit record is missing (AC-007)', () => {
  test('a completed and an in-progress booking with no visit row each show E6 with their status', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const completed = await makeExceptionBooking({ requested: R })
    const started = await makeExceptionBooking({ requested: R })
    await setStatus(completed.id, 'completed')
    await setStatus(started.id, 'in_progress')
    try {
      await admin.setNow(plus(R, hours(1)))

      const rows = await exceptionsFor(admin, completed.id, started.id)
      const byId = Object.fromEntries(rows.map((row) => [row.booking_id, row]))
      expect(flagsOf(byId[completed.id])).toEqual(['e6'])
      expect(byId[completed.id].status).toBe('completed')
      expect(flagsOf(byId[started.id])).toEqual(['e6'])
      expect(byId[started.id].status).toBe('in_progress')
    } finally {
      // set-up only, put back, so the probe of FD-VISIT 7.3 item 13 returns nothing at the end of the suite
      await setStatus(completed.id, 'assigned')
      await setStatus(started.id, 'assigned')
    }
  })
})

test.describe('DEV-079 — which bookings are in the list at all (AC-008, R-02, R-05)', () => {
  test('requested and cancelled bookings, bookings not yet due and bookings before the window never appear; the first day of the window does', async () => {
    const admin = await newAdmin()
    const family = await makeFamily()
    const recipient = await makeRecipient({ family })
    const requested = await makeBooking({ family, recipient, status: 'requested', visit: nairobiDay(-2, '09:00') })
    const cancelled = await makeBooking({ family, recipient, status: 'cancelled', visit: nairobiDay(-2, '09:00') })
    const notDue = await makeExceptionBooking({ requested: nairobiDay(1, '09:00') })
    const tooOld = await makeExceptionBooking({ requested: nairobiDay(-8, '09:00') })
    const firstDay = await makeExceptionBooking({ requested: nairobiDay(-7, '09:00') })

    const rows = await exceptionsFor(admin, requested.id, cancelled.id, notDue.id, tooOld.id, firstDay.id)
    expect(rows.map((row) => [row.booking_id, ...flagsOf(row)]), 'only the booking on the seventh day back, as E1').toEqual([[firstDay.id, 'e1']])
  })

  test('a booking with a visit row is judged by the lower bound only', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    // checked in 31 minutes late for a visit requested today, with the Admin looking from the day after next: still inside the window
    const b = await makeExceptionBooking({ requested: R })
    await checkInAt(b, plus(R, minutes(31)))
    await admin.setNow(plus(R, hours(48)))
    expect((await exceptionsFor(admin, b.id)).map(flagsOf), 'two days on, the upper bound does not hide it').toEqual([['e2', 'e3']])
  })
})

test.describe('DEV-079 — one row per booking, in order (AC-013, AC-018)', () => {
  test('a booking with several exceptions is one row carrying all of them', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    const checkedIn = plus(R, minutes(45))
    await checkInAt(b, checkedIn)
    await admin.setNow(plus(checkedIn, hours(9)))
    await removeVerified(admin, b.caregiver)

    const rows = await exceptionsFor(admin, b.id)
    expect(rows).toHaveLength(1)
    expect(flagsOf(rows[0])).toEqual(['e2', 'e3', 'e5'])
    expect(rows[0].minutes_late).toBe(45)
    expect(rows[0].minutes_since_check_in).toBe(540)
  })

  test('rows come ordered by requested time, oldest first, then booking id', async () => {
    const admin = await newAdmin()
    const R = requestedAt()
    const b3 = await makeExceptionBooking({ requested: plus(R, hours(2)) })
    const b1 = await makeExceptionBooking({ requested: R })
    const b2 = await makeExceptionBooking({ requested: plus(R, hours(1)) })
    const tieA = await makeExceptionBooking({ requested: plus(R, hours(3)) })
    const tieB = await makeExceptionBooking({ requested: plus(R, hours(3)) })
    await admin.setNow(plus(R, hours(6)))

    const { data, error } = await admin.client.from('admin_exceptions').select('booking_id, requested_datetime')
    expect(error).toBeNull()
    const mine = new Set([b1.id, b2.id, b3.id, tieA.id, tieB.id])
    const order = (data ?? []).filter((row) => mine.has(row.booking_id)).map((row) => row.booking_id as string)
    const tie = [tieA.id, tieB.id].sort()
    expect(order).toEqual([b1.id, b2.id, b3.id, tie[0], tie[1]])
    // and the whole list is in that order
    const all = (data ?? []) as { booking_id: string; requested_datetime: string }[]
    const sorted = [...all].sort((a, b) => new Date(a.requested_datetime).getTime() - new Date(b.requested_datetime).getTime() || a.booking_id.localeCompare(b.booking_id))
    expect(all.map((row) => row.booking_id)).toEqual(sorted.map((row) => row.booking_id))
  })
})
