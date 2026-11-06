import { test, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from './helpers'
import { formatDate } from '../../lib/datetime'
import { seedFamilyVisibility, textOfLength, LONG_REASON_LENGTH, LONG_TASK_NOTE_LENGTH, LONG_VISIT_NOTE_LENGTH, MULTI_LINE_READINGS, MULTI_LINE_VISIT_NOTE, type FamilyVisibilityData } from './family-visibility-data'
import { getChecklistItems, getEntries, getVisit, getVisitTasks, probe } from './visit-helpers'

// DEV-074: the test data for the family's visit report. Every case is built by seedFamilyVisibility with
// makeVisit through the caregiver's own session, and read back here the way the family reads it: through
// family_visit and family_visit_tasks (DEV-073) with the family's own session. Ground truth (the service
// role) is used only to check what was written.

test.describe.configure({ mode: 'serial' })

let data: FamilyVisibilityData

test.beforeAll(async () => {
  data = await seedFamilyVisibility()
})

const taskRows = async (client: SupabaseClient, bookingId: string) => {
  const { data: rows } = await client.from('family_visit_tasks').select('*').eq('booking_id', bookingId)
  return ((rows ?? []) as Record<string, any>[]).sort((a, b) => a.sort_order - b.sort_order)
}
const visitRow = async (client: SupabaseClient, bookingId: string) => {
  const { data: rows } = await client.from('family_visit').select('*').eq('booking_id', bookingId)
  return (rows ?? []) as Record<string, any>[]
}

test.describe('DEV-074 — B7 is left unaltered as the all-Done report', () => {
  test('B7 has every task Done, a note about the visit and both times (FAM-03), and nothing here touches it', async () => {
    const svc = serviceClient()
    const { data: recipient } = await svc.from('care_recipients').select('id').eq('name', 'Seed Recipient 3').maybeSingle()
    test.skip(!recipient, 'the starter set is not seeded in this database')
    const { data: booking } = await svc.from('bookings').select('id, status, bundle_code').eq('care_recipient_id', recipient!.id).eq('bundle_code', 'doctors_day_out').single()
    expect(booking!.status).toBe('completed')
    const visit = (await getVisit(booking!.id))!
    expect(visit.checked_in_at).toBeTruthy()
    expect(visit.checked_out_at).toBeTruthy()
    expect(visit.visit_note).toBeTruthy()
    const tasks = await getVisitTasks(visit.id)
    expect(tasks).toHaveLength(4)
    for (const task of tasks) {
      const entries = await getEntries(task.id)
      expect(entries[entries.length - 1].outcome, task.name).toBe('done')
    }
    // and no factory case in this module is attached to a starter-set account
    const emails = (await svc.from('profiles').select('email').in('id', [data.family.userId, data.otherFamily.userId])).data ?? []
    expect(emails.every((p) => String(p.email).startsWith('e2e-'))).toBe(true)
  })
})

test.describe('DEV-074 — the MediCheck report: a changed task, a reason, multi-line text, an unlogged Optional task', () => {
  test('through the family\'s own session', async () => {
    const { family, booking } = data.medicheck
    const tasks = await taskRows(family.client, booking.id)
    expect(tasks.map((t) => t.name)).toEqual(['Medication assistance', 'Vitals check', 'Companionship'])

    // Medication assistance: Done, then changed to Not done with a reason; the report shows only the last
    expect(tasks[0]).toMatchObject({ outcome: 'not_done', reason: 'She refused the second dose', note: null })
    expect(JSON.stringify(tasks)).not.toContain('Gave the morning tablets')
    // Vitals check: Done with a multi-line note, line breaks and the blank line kept
    expect(tasks[1]).toMatchObject({ outcome: 'done', note: MULTI_LINE_READINGS, reason: null })
    expect(String(tasks[1].note).split('\n')).toHaveLength(4)
    // Companionship: never logged
    expect(tasks[2]).toMatchObject({ outcome: 'not_recorded', logged_at: null, reason: null, note: null })

    const visit = await visitRow(family.client, booking.id)
    expect(visit).toHaveLength(1)
    expect(visit[0].visit_note).toBe(MULTI_LINE_VISIT_NOTE)
    expect(visit[0].checked_out_at).toBeTruthy()
  })

  test('the earlier entry is in the visit record, and the visit is dated today in Nairobi', async () => {
    const { booking } = data.medicheck
    const tasks = await getVisitTasks(booking.visitId!)
    const medication = await getEntries(tasks.find((t) => t.name === 'Medication assistance')!.id)
    expect(medication.map((e) => e.outcome)).toEqual(['done', 'not_done'])
    expect(formatDate((await getVisit(booking.id))!.checked_in_at)).toBe(formatDate(new Date()))
  })
})

test.describe('DEV-074 — the Doctor\'s Day Out report: a Not done task, an Optional task never logged', () => {
  test('through the family\'s own session', async () => {
    const { family, booking } = data.clinic
    const tasks = await taskRows(family.client, booking.id)
    expect(tasks.map((t) => t.name)).toEqual((await getChecklistItems('doctors_day_out')).map((i) => i.name))
    const byName = Object.fromEntries(tasks.map((t) => [t.name, t]))
    expect(byName['Advocacy and note-taking']).toMatchObject({ outcome: 'not_done', reason: 'The doctor ran late and we left before the discussion', note: null })
    expect(byName['Pre-visit preparation']).toMatchObject({ outcome: 'not_recorded', logged_at: null })
    expect(byName['Post-visit summary']).toMatchObject({ outcome: 'done', note: 'Review in two weeks. New tablet each evening.' })
    expect(byName['Transport and escort'].outcome).toBe('done')
    // no visit note was written: the report has no note card
    expect((await visitRow(family.client, booking.id))[0].visit_note).toBeNull()
  })
})

test.describe('DEV-074 — the longest texts, with apostrophes, accents and line breaks', () => {
  test('a 2,000-character task note, a 500-character reason and a 2,000-character visit note arrive whole and unchanged', async () => {
    const { family, booking, taskNote, reason, visitNote } = data.long
    expect(taskNote).toHaveLength(LONG_TASK_NOTE_LENGTH)
    expect(reason).toHaveLength(LONG_REASON_LENGTH)
    expect(visitNote).toHaveLength(LONG_VISIT_NOTE_LENGTH)
    for (const text of [taskNote, reason, visitNote]) {
      expect(text).toContain("'")
      expect(text).toContain('é')
      expect(text).toContain('\n')
    }

    const tasks = await taskRows(family.client, booking.id)
    expect(tasks.find((t) => t.name === 'Vitals check')!.note).toBe(taskNote)
    expect(tasks.find((t) => t.name === 'Medication assistance')!.reason).toBe(reason)
    expect((await visitRow(family.client, booking.id))[0].visit_note).toBe(visitNote)
  })

  test('textOfLength is exactly the length asked, never starts or ends with a space, and ends with a full stop', () => {
    for (const length of [50, 500, 2000]) {
      const text = textOfLength(length, 'Head: ')
      expect(text).toHaveLength(length)
      expect(text).toBe(text.trim())
      expect(text.endsWith('.')).toBe(true)
    }
  })
})

test.describe('DEV-074 — a completed booking whose caregiver has since lost Verified (BR-006, AC-014)', () => {
  test('the report is unchanged for the family', async () => {
    const { family, caregiver, booking } = data.lostVerified
    const latest = (await serviceClient().from('caregiver_verifications').select('action').eq('caregiver_id', caregiver.userId).order('created_at', { ascending: false }).limit(1)).data
    expect(latest![0].action).toBe('removed')

    expect(await visitRow(family.client, booking.id)).toHaveLength(1)
    const tasks = await taskRows(family.client, booking.id)
    expect(tasks).toHaveLength(3)
    expect(tasks.find((t) => t.name === 'Vitals check')).toMatchObject({ outcome: 'done', note: 'Blood pressure 120/80' })
    // the booking itself still shows the caregiver's name, as a finished visit keeps it
    const card = await family.client.from('family_bookings').select('status, caregiver_name').eq('id', booking.id).single()
    expect(card.data).toMatchObject({ status: 'completed', caregiver_name: caregiver.fullName })
  })
})

test.describe('DEV-074 — F4 and F2, each for its own factory family', () => {
  test('F4: completed by hand with no visit at all: no visit row, no tasks', async () => {
    const { family, booking } = data.noVisit
    expect(await getVisit(booking.id)).toBeNull()
    const card = await family.client.from('family_bookings').select('status').eq('id', booking.id).single()
    expect(card.data!.status).toBe('completed')
    expect(await visitRow(family.client, booking.id)).toEqual([])
    expect(await taskRows(family.client, booking.id)).toEqual([])
  })

  test('F2: in progress with a partly logged set: the check-in time only, no task, outcome or note', async () => {
    const { family, booking } = data.inProgress
    const visit = await visitRow(family.client, booking.id)
    expect(visit).toHaveLength(1)
    expect(visit[0].checked_in_at).toBeTruthy()
    expect(visit[0].checked_out_at).toBeNull()
    expect(await taskRows(family.client, booking.id)).toEqual([])
    // the set really is partly logged: one Required task has an outcome and the other does not
    const tasks = await getVisitTasks((await getVisit(booking.id))!.id)
    const logged = await Promise.all(tasks.map(async (t) => [t.name, (await getEntries(t.id)).length] as const))
    expect(Object.fromEntries(logged)).toEqual({ 'Medication assistance': 1, 'Vitals check': 0, Companionship: 0 })
  })
})

test.describe('DEV-074 — the second factory family, for the cross-family cases', () => {
  test('owns nothing and reads nothing of the others', async () => {
    const cases = [data.medicheck, data.clinic, data.long, data.lostVerified, data.noVisit, data.inProgress]
    for (const { booking } of cases) {
      expect(await visitRow(data.otherFamily.client, booking.id)).toEqual([])
      expect(await taskRows(data.otherFamily.client, booking.id)).toEqual([])
    }
  })
})

test.describe('DEV-074 — the rules still hold for everything built here', () => {
  test('the probe finds nothing wrong in the visits that were made through the real functions', async () => {
    const real = [data.medicheck, data.clinic, data.long, data.lostVerified, data.inProgress].map((c) => c.booking.id)
    expect(await probe({ bookingIds: real })).toEqual([])
  })
})
