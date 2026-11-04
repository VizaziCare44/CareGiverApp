import { test, expect } from '@playwright/test'
import { formatDate, formatTime } from '../../lib/datetime'
import { longCareNote, LONG_CARE_NOTE_LENGTH } from '../../scripts/seed/starter-set.mjs'
import { logInViaUI, serviceClient } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, makeVisit, nairobiDay, nairobiTime, today, tomorrow, yesterday } from './factories'
import { clearClock, countClockRows, getChecklistItems, getEntries, getVisit, getVisitTasks, hasClock, localDbUrl, probe, setClock } from './visit-helpers'

// DEV-070: the FD-VISIT factories (makeVisit, makeBooking in progress or completed), the
// day-relative helpers (nairobiDay), the test clock, the read helpers and the probe, and the size
// check on a long care note. The data layer under them (migrations 0011 to 0017) is a DRAFT.

const svc = () => serviceClient()

test.describe('DEV-070 — nairobiDay', () => {
  test('is the Nairobi calendar day at the chosen time, 09:00 by default, with today, tomorrow and yesterday as offsets', () => {
    expect([yesterday, today, tomorrow]).toEqual([-1, 0, 1])
    expect(nairobiDay().getTime()).toBe(nairobiTime({ days: 0, hour: 9 }).getTime())
    expect(formatTime(nairobiDay(today))).toBe('09:00 EAT')
    expect(formatTime(nairobiDay(tomorrow, '14:30'))).toBe('14:30 EAT')
    expect(nairobiDay(tomorrow).getTime() - nairobiDay(today).getTime()).toBe(24 * 3600 * 1000)
    expect(nairobiDay(today).getTime() - nairobiDay(yesterday).getTime()).toBe(24 * 3600 * 1000)
    expect(formatDate(nairobiDay(tomorrow, '00:00'))).toBe(formatDate(nairobiDay(tomorrow, '23:59')))
  })

  test('is computed in Nairobi and not in UTC: at the UTC date change it is already tomorrow there', () => {
    const lateEvening = new Date('2030-01-15T21:30:00.000Z') // 00:30 on the 16th in Nairobi
    expect(nairobiDay(today, '09:00', lateEvening).toISOString()).toBe('2030-01-16T06:00:00.000Z')
    expect(nairobiDay(yesterday, '09:00', lateEvening).toISOString()).toBe('2030-01-15T06:00:00.000Z')
    const justBefore = new Date('2030-01-15T20:59:00.000Z') // 23:59 on the 15th in Nairobi
    expect(nairobiDay(today, '09:00', justBefore).toISOString()).toBe('2030-01-15T06:00:00.000Z')
  })

  test('refuses a time that is not HH:MM', () => {
    for (const bad of ['9', '25:00', '09:60', 'nine', '']) expect(() => nairobiDay(today, bad), bad).toThrow(/not a time/)
  })
})

test.describe('DEV-070 — makeVisit', () => {
  test('an open visit: the real check_in, then the tasks it is given, as the caregiver', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const booking = await makeBooking({ family, status: 'assigned', caregiver, visit: nairobiDay(today) })

    const visit = await makeVisit({
      booking,
      caregiver,
      tasks: [
        { key: 'Medication assistance', outcome: 'not_done', reason: 'Not delivered yet' },
        { key: 'Medication assistance', outcome: 'done', note: 'Gave them' },
      ],
    })
    expect(visit.checkedOutAt).toBeNull()
    expect((await svc().from('bookings').select('status').eq('id', booking.id).single()).data!.status).toBe('in_progress')

    const tasks = await getVisitTasks(visit.id)
    expect(tasks.map((t) => t.name)).toEqual((await getChecklistItems('medicheck')).map((i) => i.name))
    const entries = await getEntries(tasks.find((t) => t.name === 'Medication assistance')!.id)
    expect(entries.map((e) => [e.outcome, e.note, e.reason])).toEqual([['not_done', null, 'Not delivered yet'], ['done', 'Gave them', null]])
    expect(await getEntries(tasks.find((t) => t.name === 'Vitals check')!.id)).toEqual([])
    expect(await probe({ bookingIds: [booking.id] })).toEqual([])
  })

  test('a closed visit: the Required tasks it was not given are logged Done, the Optional one is left, and the note is kept', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const booking = await makeBooking({ family, status: 'assigned', caregiver, visit: nairobiDay(today), bundle: 'doctors_day_out' })

    const visit = await makeVisit({ booking, caregiver, tasks: [{ key: 'Post-visit summary', outcome: 'done', note: 'Next visit in two weeks' }], closed: true, visitNote: 'All went well' })
    expect(visit.checkedOutAt).not.toBeNull()
    expect(visit.visitNote).toBe('All went well')
    expect((await svc().from('bookings').select('status').eq('id', booking.id).single()).data!.status).toBe('completed')

    const tasks = await getVisitTasks(visit.id)
    for (const task of tasks) {
      const entries = await getEntries(task.id)
      if (task.required) expect(entries.length, task.name).toBe(1)
      else expect(entries, task.name).toEqual([])
    }
    expect((await getEntries(tasks.find((t) => t.name === 'Post-visit summary')!.id))[0].note).toBe('Next visit in two weeks')
    expect(await probe({ bookingIds: [booking.id] })).toEqual([])
  })

  test('the rules are the rules: a refusal comes back as the function\'s own message', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const booking = await makeBooking({ family, status: 'assigned', caregiver, visit: nairobiDay(today) })
    await expect(makeVisit({ booking, caregiver, tasks: [{ key: 'Vitals check', outcome: 'done' }] })).rejects.toThrow(/NOTE_REQUIRED/)
    await expect(makeVisit({ booking, caregiver: await makeCaregiver({ verified: true }), tasks: [] })).rejects.toThrow(/check_in refused: BOOKING_NOT_FOUND/)

    const family2 = await makeFamily()
    const unverified = await makeCaregiver({ verified: 'removed' })
    const other = await makeBooking({ family: family2, status: 'assigned', caregiver: unverified, visit: nairobiDay(today) })
    await expect(makeVisit({ booking: other, caregiver: unverified })).rejects.toThrow(/CAREGIVER_NOT_VERIFIED/)
    expect(await getVisit(other.id)).toBeNull()
  })

  test('a booking not dated today, with no clock for the caregiver, stops with a clear message and writes nothing', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const booking = await makeBooking({ family, status: 'assigned', caregiver, visit: nairobiDay(tomorrow) })
    await expect(makeVisit({ booking, caregiver })).rejects.toThrow(/not today .* no test clock is set for this caregiver/)
    expect(await getVisit(booking.id)).toBeNull()
    expect((await svc().from('bookings').select('status').eq('id', booking.id).single()).data!.status).toBe('assigned')

    // and so does makeBooking in progress for a booking on another day
    await expect(makeBooking({ family, status: 'in_progress', caregiver, visit: nairobiDay(yesterday) })).rejects.toThrow(/no test clock is set/)
    // and without the caregiver's own session
    await expect(makeBooking({ family, status: 'in_progress', caregiver: { userId: caregiver.userId } })).rejects.toThrow(/needs its own session/)
  })

  test('with a clock set for the caregiver, the booking can be on another day, and the visit is stamped with the clock', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const other = await makeCaregiver({ verified: true })
    const booking = await makeBooking({ family, status: 'assigned', caregiver, visit: nairobiDay(tomorrow) })
    const instant = nairobiDay(tomorrow, '10:15')
    try {
      await setClock(caregiver, instant)
      expect(await hasClock(caregiver)).toBe(true)
      expect(await hasClock(other)).toBe(false)
      expect(await countClockRows()).toBeGreaterThanOrEqual(1)

      const visit = await makeVisit({ booking, caregiver })
      expect(new Date(visit.checkedInAt).getTime()).toBe(instant.getTime())

      // the clock is one caregiver's: another caregiver's check-in today is stamped with the real time
      const othersBooking = await makeBooking({ family, status: 'assigned', caregiver: other, visit: nairobiDay(today) })
      const othersVisit = await makeVisit({ booking: othersBooking, caregiver: other })
      expect(Math.abs(new Date(othersVisit.checkedInAt).getTime() - Date.now())).toBeLessThan(60_000)
    } finally {
      await clearClock(caregiver)
    }
    expect(await hasClock(caregiver)).toBe(false)
  })

  test('the clock refuses any host but the local stack, before it connects', () => {
    const saved = process.env.E2E_DB_URL
    try {
      process.env.E2E_DB_URL = 'postgresql://postgres:x@db.example.com:5432/postgres'
      expect(() => localDbUrl()).toThrow(/not the local stack/)
      process.env.E2E_DB_URL = 'not a url'
      expect(() => localDbUrl()).toThrow(/not a valid URL/)
      process.env.E2E_DB_URL = 'postgresql://postgres:x@127.0.0.1:54322/postgres'
      expect(localDbUrl()).toContain('127.0.0.1')
    } finally {
      if (saved === undefined) delete process.env.E2E_DB_URL
      else process.env.E2E_DB_URL = saved
    }
  })
})

test.describe('DEV-070 — makeBooking in progress and completed', () => {
  for (const status of ['in_progress', 'completed'] as const) {
    test(`${status}: made through the real functions, so the visit is there and the probe passes`, async () => {
      const family = await makeFamily()
      const caregiver = await makeCaregiver({ verified: true })
      const booking = await makeBooking({ family, status, caregiver })
      expect(booking.status).toBe(status)
      expect(booking.visitId).not.toBeNull()
      const visit = (await getVisit(booking.id))!
      expect(visit.id).toBe(booking.visitId)
      expect(visit.caregiver_id).toBe(caregiver.userId)
      expect(visit.checked_out_at === null).toBe(status === 'in_progress')
      expect(formatDate(booking.visit)).toBe(formatDate(new Date()))
      expect(await probe({ bookingIds: [booking.id] })).toEqual([])
    })
  }

  test('a requested, assigned or cancelled booking has no visit', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    expect((await makeBooking({ family })).visitId).toBeNull()
    const assigned = await makeBooking({ family, status: 'assigned', caregiver })
    expect(assigned.visitId).toBeNull()
    expect(await getVisit(assigned.id)).toBeNull()
  })
})

test.describe('DEV-070 — the probe', () => {
  test('lists a booking in progress that has no visit, and an entry logged outside the visit', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const booking = await makeBooking({ family, status: 'assigned', caregiver })
    expect((await svc().from('bookings').update({ status: 'in_progress' }).eq('id', booking.id)).error).toBeNull()
    expect(await probe({ bookingIds: [booking.id] })).toEqual([{ kind: 'BOOKING_WITHOUT_VISIT', bookingId: booking.id, status: 'in_progress' }])

    const second = await makeBooking({ family, status: 'in_progress', caregiver: await makeCaregiver({ verified: true }) })
    const task = (await getVisitTasks(second.visitId!))[0]
    const early = await svc().from('visit_task_entries').insert({ visit_task_id: task.id, outcome: 'done', logged_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() })
    expect(early.error).toBeNull()
    const found = await probe({ bookingIds: [second.id] })
    expect(found.map((o) => o.kind)).toEqual(['ENTRY_OUTSIDE_VISIT'])
  })

  test('lists a closed visit with a Required task not logged, and a status that does not match', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const booking = await makeBooking({ family, status: 'in_progress', caregiver })
    // closed by hand, as a test that bypasses check_out would leave it
    expect((await svc().from('visits').update({ checked_out_at: new Date(Date.now() + 1000).toISOString() }).eq('id', booking.visitId!)).error).toBeNull()
    const kinds = (await probe({ bookingIds: [booking.id] })).map((o) => o.kind)
    expect(kinds).toContain('STATUS_MISMATCH')
    expect(kinds).toContain('REQUIRED_TASK_NOT_LOGGED')
  })
})

test.describe('DEV-070 — a long care note (item 4)', () => {
  const note = longCareNote('Takes tablets with breakfast.')

  test('a 2,000-character note with apostrophes, accents and line breaks is stored in full and reads back unchanged', async () => {
    expect(note).toHaveLength(LONG_CARE_NOTE_LENGTH)
    expect(note).toContain("'")
    expect(note).toContain('é')
    expect(note).toContain('\n')

    const family = await makeFamily()
    const recipient = await makeRecipient({ family, careNotes: note })
    const stored = await svc().from('care_recipients').select('care_notes').eq('id', recipient.id).single()
    expect(stored.data!.care_notes).toHaveLength(2000)
    expect(stored.data!.care_notes).toBe(note)

    // read back through the family's own session
    const own = await family.client.from('care_recipients').select('care_notes').eq('id', recipient.id).single()
    expect(own.data!.care_notes).toBe(note)
  })

  test('and the caregiver\'s Assignment Detail shows it in full', async ({ page }) => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const recipient = await makeRecipient({ family, careNotes: note })
    const booking = await makeBooking({ family, recipient, status: 'assigned', caregiver })
    await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
    await page.goto(`/assignments/${booking.id}`)
    const shown = await page.locator('section[aria-labelledby="care-notes-heading"] p').innerText()
    expect(shown).toBe(note)
  })
})
