import { test, expect } from '@playwright/test'
import { serviceClient } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, nairobiTime, type TestCaregiver } from './factories'
import {
  VISIT_FUNCTION_ERRORS,
  VISIT_PENDING_TEXT,
  describeVisitError,
  toVisitFailure,
  type VisitActionName,
  type VisitFailure,
  type VisitFunctionErrorCode,
} from '../../lib/visits/action-errors'

// DEV-069: the one mapping from the errors of check_in, log_visit_task and check_out to the
// screen's behaviour and text, and a guard that it covers every error the functions can really
// raise. The wording is a DRAFT pending FD-VISIT §7.3.

const ACTIONS = Object.keys(VISIT_FUNCTION_ERRORS) as VisitActionName[]
const FUNCTION_CODES: VisitFailure[] = [...new Set<VisitFailure>(ACTIONS.flatMap((action) => [...VISIT_FUNCTION_ERRORS[action]]))]
const ALL_CODES: VisitFailure[] = [...FUNCTION_CODES, 'NOT_SIGNED_IN', 'CONNECTION', 'UNKNOWN']

test.describe('DEV-069 — describeVisitError', () => {
  test('every code, for every action, has behaviour and never shows a raw code', () => {
    for (const code of ALL_CODES) {
      for (const action of ACTIONS) {
        const info = describeVisitError(code, action)
        // either plain text, or the screen redraws into the state that explains it
        if (info.message === null) {
          expect(info.refresh, `${code}/${action}`).toBe(true)
        } else {
          expect(info.message.length, `${code}/${action}`).toBeGreaterThan(10)
          expect(info.message, `${code}/${action}`).not.toMatch(/[A-Z]{2,}_[A-Z0-9_]+/)
          expect(info.message, `${code}/${action}`).not.toMatch(/P0001|42501|permission denied|violates/i)
        }
      }
    }
  })

  test('what the screen does about each failure', () => {
    // the booking, task or visit is no longer the Caregiver\'s, or the day or the other visit changed: reload, no text
    for (const code of ['NOT_CAREGIVER', 'CAREGIVER_NOT_VERIFIED', 'BOOKING_NOT_FOUND', 'BOOKING_NOT_ASSIGNED', 'NOT_VISIT_DAY', 'ANOTHER_VISIT_IN_PROGRESS', 'TASK_NOT_FOUND', 'VISIT_NOT_FOUND', 'REQUIRED_TASKS_MISSING'] as const) {
      expect(describeVisitError(code, 'check-in'), code).toEqual({ message: null, refresh: true, closed: false, retry: false })
    }

    // a visit already checked out
    const closed = describeVisitError('VISIT_CLOSED', 'log-task')
    expect(closed.closed).toBe(true)
    expect(closed.refresh).toBe(false)

    // text the Caregiver wrote is never lost: these stay on the screen, say why, and offer no retry
    for (const [code, action] of [['NOTE_REQUIRED', 'log-task'], ['REASON_REQUIRED', 'log-task'], ['NOTE_TOO_LONG', 'log-task'], ['REASON_TOO_LONG', 'log-task'], ['VISIT_NOTE_TOO_LONG', 'check-out']] as const) {
      const info = describeVisitError(code, action)
      expect(info.message, code).toBeTruthy()
      expect(info.refresh, code).toBe(false)
      expect(info.retry, code).toBe(false)
    }
    expect(describeVisitError('NOTE_TOO_LONG', 'log-task').message).toContain('2,000')
    expect(describeVisitError('REASON_TOO_LONG', 'log-task').message).toContain('500')
    expect(describeVisitError('VISIT_NOTE_TOO_LONG', 'check-out').message).toContain('2,000')

    // only connection-type failures offer a retry; none of them reload
    for (const code of ['CONNECTION', 'UNKNOWN'] as const) {
      for (const action of ACTIONS) {
        const info = describeVisitError(code, action)
        expect(info.retry, `${code}/${action}`).toBe(true)
        expect(info.refresh, `${code}/${action}`).toBe(false)
      }
    }
    expect(describeVisitError('NOT_SIGNED_IN', 'check-in')).toMatchObject({ message: 'Your session has ended. Please log in again.', refresh: false, retry: false })
  })

  test('the wording follows the action where it matters', () => {
    expect(describeVisitError('CONNECTION', 'check-in').message).toBe("Couldn't check in — check your connection and try again.")
    expect(describeVisitError('CONNECTION', 'log-task').message).toBe('Not saved. Check your connection and try again. What you typed is still here.')
    expect(describeVisitError('CONNECTION', 'check-out').message).toBe('Not checked out. Check your connection and try again. What you typed is still here.')
    expect(new Set(ACTIONS.map((action) => describeVisitError('UNKNOWN', action).message)).size).toBe(ACTIONS.length)
  })

  test('a code the mapping does not name gets the generic text', () => {
    for (const action of ACTIONS) {
      const info = describeVisitError('SOMETHING_NEW' as VisitFailure, action)
      expect(info).toEqual(describeVisitError('UNKNOWN', action))
      expect(info.message).not.toContain('SOMETHING_NEW')
    }
  })

  test('disabled-state text while a request runs', () => {
    expect(VISIT_PENDING_TEXT).toEqual({ 'check-in': 'Checking in…', 'log-task': 'Saving…', 'check-out': 'Checking out…' })
  })

  test('toVisitFailure only trusts the codes that function raises', () => {
    expect(toVisitFailure('check-in', { message: 'NOT_VISIT_DAY' })).toBe('NOT_VISIT_DAY')
    expect(toVisitFailure('log-task', { message: 'VISIT_CLOSED' })).toBe('VISIT_CLOSED')
    expect(toVisitFailure('check-out', { message: 'REQUIRED_TASKS_MISSING' })).toBe('REQUIRED_TASKS_MISSING')
    // another function's code, a database message, a wrong-case code and no error at all: UNKNOWN, text never passed on
    expect(toVisitFailure('check-in', { message: 'VISIT_CLOSED' })).toBe('UNKNOWN')
    expect(toVisitFailure('check-out', { message: 'NOTE_TOO_LONG' })).toBe('UNKNOWN')
    expect(toVisitFailure('check-in', { message: 'permission denied for function check_in' })).toBe('UNKNOWN')
    expect(toVisitFailure('log-task', { message: 'JWT expired' })).toBe('UNKNOWN')
    expect(toVisitFailure('check-in', { message: 'not_visit_day' })).toBe('UNKNOWN')
    expect(toVisitFailure('check-in', null)).toBe('UNKNOWN')
  })
})

test.describe('DEV-069 — against the real functions', () => {
  const unknownId = '00000000-0000-4000-8000-00000000dead'

  async function assignedToday(caregiver: TestCaregiver, opts: { status?: 'assigned' | 'cancelled'; days?: number } = {}) {
    const family = await makeFamily()
    const recipient = await makeRecipient({ family })
    return makeBooking({ family, recipient, status: opts.status ?? 'assigned', caregiver, visit: nairobiTime({ days: opts.days ?? 0, hour: 9 }) })
  }

  async function taskId(bookingId: string, name: string) {
    const svc = serviceClient()
    const visit = await svc.from('visits').select('id').eq('booking_id', bookingId).single()
    const task = await svc.from('visit_tasks').select('id').eq('visit_id', visit.data!.id).eq('name', name).single()
    return task.data!.id as string
  }

  test('every error the three functions raise maps to its own code', async () => {
    const caregiver = await makeCaregiver({ verified: true })
    const unverified = await makeCaregiver({ verified: 'removed' })
    const family = await makeFamily()

    const seen: Record<VisitActionName, Set<string>> = { 'check-in': new Set(), 'log-task': new Set(), 'check-out': new Set() }
    const expectCode = (action: VisitActionName, response: { error: { message?: string | null } | null }, expected: VisitFunctionErrorCode) => {
      expect(toVisitFailure(action, response.error), `${action}/${expected}`).toBe(expected)
      seen[action].add(expected)
      const info = describeVisitError(expected, action)
      expect(info.message ?? 'redraw').toBeTruthy()
    }

    // check_in
    const checkIn = (client: TestCaregiver['client'], id: string) => client.rpc('check_in', { p_booking_id: id })
    expectCode('check-in', await checkIn(family.client, unknownId), 'NOT_CAREGIVER')
    expectCode('check-in', await checkIn(unverified.client, unknownId), 'CAREGIVER_NOT_VERIFIED')
    expectCode('check-in', await checkIn(caregiver.client, unknownId), 'BOOKING_NOT_FOUND')
    const cancelled = await assignedToday(caregiver, { status: 'cancelled' })
    expectCode('check-in', await checkIn(caregiver.client, cancelled.id), 'BOOKING_NOT_ASSIGNED')
    const tomorrow = await assignedToday(caregiver, { days: 1 })
    expectCode('check-in', await checkIn(caregiver.client, tomorrow.id), 'NOT_VISIT_DAY')
    const first = await assignedToday(caregiver)
    const second = await assignedToday(caregiver)
    expect((await checkIn(caregiver.client, first.id)).error).toBeNull()
    expectCode('check-in', await checkIn(caregiver.client, second.id), 'ANOTHER_VISIT_IN_PROGRESS')

    // log_visit_task, on the open visit (MediCheck: Medication assistance needs no note, Vitals check does)
    const medication = await taskId(first.id, 'Medication assistance')
    const vitals = await taskId(first.id, 'Vitals check')
    const log = (client: TestCaregiver['client'], task: string, outcome: string, note: string | null, reason: string | null) =>
      client.rpc('log_visit_task', { p_task_id: task, p_outcome: outcome, p_note: note, p_reason: reason })
    expectCode('log-task', await log(family.client, medication, 'done', null, null), 'NOT_CAREGIVER')
    expectCode('log-task', await log(unverified.client, medication, 'done', null, null), 'CAREGIVER_NOT_VERIFIED')
    expectCode('log-task', await log(caregiver.client, unknownId, 'done', null, null), 'TASK_NOT_FOUND')
    expectCode('log-task', await log(caregiver.client, medication, 'maybe', null, null), 'INVALID_OUTCOME')
    expectCode('log-task', await log(caregiver.client, vitals, 'done', null, null), 'NOTE_REQUIRED')
    expectCode('log-task', await log(caregiver.client, medication, 'not_done', null, null), 'REASON_REQUIRED')
    expectCode('log-task', await log(caregiver.client, medication, 'done', 'x'.repeat(2001), null), 'NOTE_TOO_LONG')
    expectCode('log-task', await log(caregiver.client, medication, 'not_done', null, 'x'.repeat(501)), 'REASON_TOO_LONG')

    // check_out
    const checkOut = (client: TestCaregiver['client'], id: string, note = '') => client.rpc('check_out', { p_booking_id: id, p_visit_note: note })
    expectCode('check-out', await checkOut(family.client, unknownId), 'NOT_CAREGIVER')
    expectCode('check-out', await checkOut(unverified.client, unknownId), 'CAREGIVER_NOT_VERIFIED')
    expectCode('check-out', await checkOut(caregiver.client, unknownId), 'BOOKING_NOT_FOUND')
    expectCode('check-out', await checkOut(caregiver.client, tomorrow.id), 'VISIT_NOT_FOUND')
    expectCode('check-out', await checkOut(caregiver.client, first.id, 'x'.repeat(2001)), 'VISIT_NOTE_TOO_LONG')
    expectCode('check-out', await checkOut(caregiver.client, first.id), 'REQUIRED_TASKS_MISSING')

    // VISIT_CLOSED needs a finished visit
    expect((await log(caregiver.client, medication, 'done', null, null)).error).toBeNull()
    expect((await log(caregiver.client, vitals, 'done', 'BP 120/80', null)).error).toBeNull()
    expect((await checkOut(caregiver.client, first.id)).error).toBeNull()
    expectCode('log-task', await log(caregiver.client, medication, 'not_done', null, 'Changed my mind'), 'VISIT_CLOSED')

    // the guard: the checks above must raise every code the mapping knows about
    for (const action of ACTIONS) {
      expect([...seen[action]].sort(), action).toEqual([...VISIT_FUNCTION_ERRORS[action]].sort())
    }
  })
})
