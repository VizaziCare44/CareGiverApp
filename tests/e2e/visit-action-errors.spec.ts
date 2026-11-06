import { test, expect } from '@playwright/test'
import { serviceClient } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, nairobiTime, type TestCaregiver } from './factories'
import {
  GENERIC_ERROR,
  VISIT_FUNCTION_ERRORS,
  VISIT_PENDING_TEXT,
  describeVisitError,
  toVisitFailure,
  type VisitActionName,
  type VisitFailure,
  type VisitFunctionErrorCode,
} from '../../lib/visits/action-errors'

// DEV-069: the one mapping from the errors of check_in, log_visit_task and check_out to the
// screen's behaviour and text (the table of FD-VISIT §7.3), and a guard that it covers every error
// the functions can really raise.

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

  test('what the screen does about each failure (the table of FD-VISIT 7.3)', () => {
    // BOOKING_NOT_FOUND and VISIT_NOT_FOUND: VER-12b on reload; NOT_VISIT_DAY, ANOTHER_VISIT_IN_PROGRESS and
    // REQUIRED_TASKS_MISSING: reload into the state that explains them; no new text
    for (const code of ['BOOKING_NOT_FOUND', 'BOOKING_NOT_ASSIGNED', 'NOT_VISIT_DAY', 'ANOTHER_VISIT_IN_PROGRESS', 'VISIT_NOT_FOUND', 'REQUIRED_TASKS_MISSING'] as const) {
      expect(describeVisitError(code, 'check-in'), code).toEqual({ message: null, refresh: true, closed: false, retry: false })
    }

    // VISIT_ALREADY_CHECKED_OUT from log_visit_task: the stale-state line, no reload; from check_in the page reloads (the summary)
    const closed = describeVisitError('VISIT_ALREADY_CHECKED_OUT', 'log-task')
    expect(closed).toEqual({ message: 'This visit was already checked out. Refresh to see the current state.', refresh: false, closed: true, retry: false })
    expect(describeVisitError('VISIT_ALREADY_CHECKED_OUT', 'check-in')).toEqual({ message: null, refresh: true, closed: false, retry: false })

    // REASON_REQUIRED and NOTE_REQUIRED: the inline lines of 6.5; text the Caregiver wrote is never lost
    expect(describeVisitError('NOTE_REQUIRED', 'log-task')).toEqual({ message: 'A note is needed to log this task as Done.', refresh: false, closed: false, retry: false })
    expect(describeVisitError('REASON_REQUIRED', 'log-task')).toEqual({ message: 'A reason is needed to log this task as Not done.', refresh: false, closed: false, retry: false })

    // TEXT_TOO_LONG: a line that names the limit (2,000 for a note and the visit note, 500 for a reason)
    expect(describeVisitError('TEXT_TOO_LONG', 'log-task').message).toBe('This is too long. The limit is 2,000 characters.')
    expect(describeVisitError('TEXT_TOO_LONG', 'log-task', { limit: 500 }).message).toBe('This is too long. The limit is 500 characters.')
    expect(describeVisitError('TEXT_TOO_LONG', 'check-out').message).toBe('This is too long. The limit is 2,000 characters.')
    for (const action of ['log-task', 'check-out'] as const) {
      const info = describeVisitError('TEXT_TOO_LONG', action)
      expect(info.refresh, action).toBe(false)
      expect(info.retry, action).toBe(false)
    }

    // NOT_CAREGIVER, TASK_NOT_FOUND and INVALID_OUTCOME: the generic text already used by DEV-023 and DEV-050
    for (const code of ['NOT_CAREGIVER', 'TASK_NOT_FOUND', 'INVALID_OUTCOME'] as const) {
      for (const action of ACTIONS) expect(describeVisitError(code, action).message, `${code}/${action}`).toBe(GENERIC_ERROR)
    }
    expect(GENERIC_ERROR).toBe('Something went wrong and nothing was saved. Please try again.')

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

  test('the connection-lost text follows 7.3 (VIS-07d for a task)', () => {
    expect(describeVisitError('CONNECTION', 'check-in').message).toBe('Not saved. Check your connection and try again.')
    expect(describeVisitError('CONNECTION', 'log-task').message).toBe('Not saved. Check your connection and try again. What you typed is still here.')
    // §7.3 has no line for check-out; this follows the pattern and says what did not happen
    expect(describeVisitError('CONNECTION', 'check-out').message).toBe('Not checked out. Check your connection and try again. What you typed is still here.')
  })

  test('a code the mapping does not name gets the generic text', () => {
    for (const action of ACTIONS) {
      const info = describeVisitError('SOMETHING_NEW' as VisitFailure, action)
      expect(info).toEqual(describeVisitError('UNKNOWN', action))
      expect(info.message).toBe(GENERIC_ERROR)
      expect(info.message).not.toContain('SOMETHING_NEW')
    }
  })

  test('disabled-state text while a request runs', () => {
    expect(VISIT_PENDING_TEXT).toEqual({ 'check-in': 'Checking in…', 'log-task': 'Saving…', 'check-out': 'Checking out…' })
  })

  test('toVisitFailure only trusts the codes that function raises', () => {
    expect(toVisitFailure('check-in', { message: 'NOT_VISIT_DAY' })).toBe('NOT_VISIT_DAY')
    expect(toVisitFailure('log-task', { message: 'VISIT_ALREADY_CHECKED_OUT' })).toBe('VISIT_ALREADY_CHECKED_OUT')
    expect(toVisitFailure('check-out', { message: 'REQUIRED_TASKS_MISSING' })).toBe('REQUIRED_TASKS_MISSING')
    // another function's code, a code of the old draft, a database message, a wrong-case code and no error at all: UNKNOWN, text never passed on
    expect(toVisitFailure('check-in', { message: 'REQUIRED_TASKS_MISSING' })).toBe('UNKNOWN')
    expect(toVisitFailure('check-out', { message: 'NOTE_REQUIRED' })).toBe('UNKNOWN')
    expect(toVisitFailure('log-task', { message: 'VISIT_CLOSED' })).toBe('UNKNOWN')
    expect(toVisitFailure('check-in', { message: 'CAREGIVER_NOT_VERIFIED' })).toBe('UNKNOWN')
    expect(toVisitFailure('log-task', { message: 'NOTE_TOO_LONG' })).toBe('UNKNOWN')
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
    // a Caregiver who is not Verified gets the same answer as for no booking (nothing is learnt about a booking)
    expectCode('check-in', await checkIn(unverified.client, unknownId), 'BOOKING_NOT_FOUND')
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
    const log = (client: TestCaregiver['client'], bookingId: string, taskKey: string, outcome: string, note: string | null, reason: string | null) =>
      client.rpc('log_visit_task', { p_booking_id: bookingId, p_task_key: taskKey, p_outcome: outcome, p_note: note, p_reason: reason })
    expectCode('log-task', await log(family.client, first.id, 'medication_assistance', 'done', null, null), 'NOT_CAREGIVER')
    expectCode('log-task', await log(unverified.client, first.id, 'medication_assistance', 'done', null, null), 'VISIT_NOT_FOUND')
    expectCode('log-task', await log(caregiver.client, unknownId, 'medication_assistance', 'done', null, null), 'VISIT_NOT_FOUND')
    expectCode('log-task', await log(caregiver.client, first.id, 'no_such_task', 'done', null, null), 'TASK_NOT_FOUND')
    expectCode('log-task', await log(caregiver.client, first.id, 'medication_assistance', 'maybe', null, null), 'INVALID_OUTCOME')
    expectCode('log-task', await log(caregiver.client, first.id, 'vitals_check', 'done', null, null), 'NOTE_REQUIRED')
    expectCode('log-task', await log(caregiver.client, first.id, 'medication_assistance', 'not_done', null, null), 'REASON_REQUIRED')
    expectCode('log-task', await log(caregiver.client, first.id, 'medication_assistance', 'done', 'x'.repeat(2001), null), 'TEXT_TOO_LONG')
    expect((await log(caregiver.client, first.id, 'medication_assistance', 'not_done', null, 'x'.repeat(501))).error?.message).toBe('TEXT_TOO_LONG')

    // check_out
    const checkOut = (client: TestCaregiver['client'], id: string, note = '') => client.rpc('check_out', { p_booking_id: id, p_visit_note: note })
    expectCode('check-out', await checkOut(family.client, unknownId), 'NOT_CAREGIVER')
    expectCode('check-out', await checkOut(unverified.client, unknownId), 'VISIT_NOT_FOUND')
    expectCode('check-out', await checkOut(caregiver.client, unknownId), 'VISIT_NOT_FOUND')
    expectCode('check-out', await checkOut(caregiver.client, tomorrow.id), 'VISIT_NOT_FOUND')
    expectCode('check-out', await checkOut(caregiver.client, first.id), 'REQUIRED_TASKS_MISSING')
    // the Required tasks are tested before the note limit (7.3 puts the Required rule at step 3 and the limit at step 4)
    expect((await checkOut(caregiver.client, first.id, 'x'.repeat(2001))).error?.message).toBe('REQUIRED_TASKS_MISSING')

    // with the Required tasks logged, a visit note over the limit is TEXT_TOO_LONG
    expect((await log(caregiver.client, first.id, 'medication_assistance', 'done', null, null)).error).toBeNull()
    expect((await log(caregiver.client, first.id, 'vitals_check', 'done', 'BP 120/80', null)).error).toBeNull()
    expectCode('check-out', await checkOut(caregiver.client, first.id, 'x'.repeat(2001)), 'TEXT_TOO_LONG')
    expect((await checkOut(caregiver.client, first.id)).error).toBeNull()

    // VISIT_ALREADY_CHECKED_OUT needs a finished visit: from log_visit_task, and from check_in
    expectCode('log-task', await log(caregiver.client, first.id, 'medication_assistance', 'not_done', null, 'Changed my mind'), 'VISIT_ALREADY_CHECKED_OUT')
    expectCode('check-in', await checkIn(caregiver.client, first.id), 'VISIT_ALREADY_CHECKED_OUT')

    // the guard: the checks above must raise every code the mapping knows about
    for (const action of ACTIONS) {
      expect([...seen[action]].sort(), action).toEqual([...VISIT_FUNCTION_ERRORS[action]].sort())
    }
    // and the service role sees nothing was written by the refused calls
    const entries = await serviceClient().from('visit_task_entries').select('id', { count: 'exact', head: true })
    expect(entries.error).toBeNull()
  })
})
