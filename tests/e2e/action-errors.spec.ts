import { test, expect } from '@playwright/test'
import { apiAddRecipient, anonClient, createUserWithRole } from './helpers'
import {
  describeActionError,
  FUNCTION_ERROR_CODES,
  PENDING_TEXT,
  toActionResult,
  type ActionErrorCode,
  type ActionName,
  type FunctionErrorCode,
} from '../../lib/admin/action-errors'

// DEV-050: the mapping from the FD-VERIFY function errors to screen text, and
// a guard that it covers every error the database functions can really raise.

const ACTIONS: ActionName[] = ['verify', 'remove', 'assign', 'change']
const ALL_CODES: ActionErrorCode[] = [...FUNCTION_ERROR_CODES, 'NOT_SIGNED_IN', 'CONNECTION', 'UNKNOWN']

test.describe('DEV-050 — describeActionError', () => {
  test('every code has plain text and never shows a raw code', () => {
    for (const code of ALL_CODES) {
      for (const action of ACTIONS) {
        const { message } = describeActionError(code, action)
        expect(message.length, `${code}/${action}`).toBeGreaterThan(10)
        expect(message, `${code}/${action}`).not.toMatch(/[A-Z]{2,}_[A-Z0-9_]+/)
        expect(message, `${code}/${action}`).not.toMatch(/P0001|42501|permission denied|violates/i)
      }
    }
  })

  test('what the screen should do about each failure', () => {
    // out-of-date screens refresh; nothing else does
    for (const code of ['ALREADY_VERIFIED', 'NOT_VERIFIED', 'BOOKING_NOT_REQUESTED', 'BOOKING_NOT_ASSIGNED', 'SAME_CAREGIVER', 'CAREGIVER_NOT_FOUND', 'BOOKING_NOT_FOUND'] as const) {
      expect(describeActionError(code, 'assign').refresh, code).toBe(true)
    }
    for (const code of ['NOTE_REQUIRED', 'NOTE_TOO_LONG', 'NOT_ADMIN', 'NOT_SIGNED_IN', 'CONNECTION', 'UNKNOWN'] as const) {
      expect(describeActionError(code, 'verify').refresh, code).toBe(false)
    }

    // a caregiver who stopped being Verified: refresh the list and drop the choice
    const notVerified = describeActionError('CAREGIVER_NOT_VERIFIED', 'assign')
    expect(notVerified.refresh).toBe(true)
    expect(notVerified.clearSelection).toBe(true)

    // only connection-type failures offer a plain retry; none of them refresh
    for (const code of ['CONNECTION', 'UNKNOWN'] as const) {
      const info = describeActionError(code, 'assign')
      expect(info.retry, code).toBe(true)
      expect(info.refresh, code).toBe(false)
      expect(info.clearSelection, code).toBe(false)
    }
    expect(describeActionError('NOTE_REQUIRED', 'verify').retry).toBe(false)

    // the wording follows the action where it matters
    expect(describeActionError('NOTE_REQUIRED', 'verify').message).not.toBe(describeActionError('NOTE_REQUIRED', 'remove').message)
    expect(describeActionError('CONNECTION', 'assign').message).toContain('assign')
    expect(describeActionError('CONNECTION', 'verify').message).toContain('save')
  })

  test('disabled-state text while a request runs', () => {
    expect(PENDING_TEXT).toEqual({ verify: 'Saving…', remove: 'Saving…', assign: 'Assigning…', change: 'Assigning…' })
  })

  test('toActionResult only trusts the function codes', () => {
    expect(toActionResult(null)).toEqual({ ok: true })
    expect(toActionResult({ message: 'ALREADY_VERIFIED', code: 'P0001' })).toEqual({ ok: false, code: 'ALREADY_VERIFIED' })
    // anything else becomes UNKNOWN, and its text is never passed on
    expect(toActionResult({ message: 'permission denied for function verify_caregiver', code: '42501' })).toEqual({ ok: false, code: 'UNKNOWN' })
    expect(toActionResult({ message: 'JWT expired', code: 'PGRST301' })).toEqual({ ok: false, code: 'UNKNOWN' })
    expect(toActionResult({ message: 'alREADY_VERIFIED' })).toEqual({ ok: false, code: 'UNKNOWN' })
  })
})

test.describe('DEV-050 — against the real functions', () => {
  test('every error the functions raise maps to its own code', async () => {
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const verified = await createUserWithRole('caregiver', 'Verified Caregiver')
    const unverified = await createUserWithRole('caregiver', 'Unverified Caregiver')
    const family = await createUserWithRole('family_member', 'Family Member')
    await admin.client.rpc('verify_caregiver', { p_caregiver_id: verified.userId, p_note: 'Met in person' })

    const recipientId = await apiAddRecipient(family.client, family.userId, 'Mzee Test')
    const newBooking = async () => {
      const { data } = await family.client
        .from('bookings')
        .insert({ account_id: family.userId, care_recipient_id: recipientId, bundle_code: 'medicheck', requested_datetime: new Date(Date.now() + 864e5).toISOString() })
        .select('id')
        .single()
      return data!.id as string
    }
    const first = await newBooking()
    const second = await newBooking()
    const unknownId = '00000000-0000-0000-0000-00000000dead'

    const seen = new Set<FunctionErrorCode>()
    const expectCode = (response: { error: { message?: string | null; code?: string | null } | null }, expected: FunctionErrorCode) => {
      const result = toActionResult(response.error)
      expect(result, expected).toEqual({ ok: false, code: expected })
      seen.add(expected)
      for (const action of ACTIONS) expect(describeActionError(expected, action).message).toBeTruthy()
    }

    expectCode(await family.client.rpc('verify_caregiver', { p_caregiver_id: verified.userId, p_note: 'x' }), 'NOT_ADMIN')
    expectCode(await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: unverified.userId, p_note: '   ' }), 'NOTE_REQUIRED')
    expectCode(await admin.client.rpc('verify_caregiver', { p_caregiver_id: unverified.userId, p_note: 'x'.repeat(1001) }), 'NOTE_TOO_LONG')
    expectCode(await admin.client.rpc('verify_caregiver', { p_caregiver_id: family.userId, p_note: 'x' }), 'CAREGIVER_NOT_FOUND')
    expectCode(await admin.client.rpc('verify_caregiver', { p_caregiver_id: verified.userId, p_note: 'again' }), 'ALREADY_VERIFIED')
    expectCode(await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: unverified.userId, p_note: 'x' }), 'NOT_VERIFIED')
    expectCode(await admin.client.rpc('assign_booking', { p_booking_id: first, p_caregiver_id: unverified.userId }), 'CAREGIVER_NOT_VERIFIED')
    expectCode(await admin.client.rpc('assign_booking', { p_booking_id: unknownId, p_caregiver_id: verified.userId }), 'BOOKING_NOT_FOUND')

    const assigned = await admin.client.rpc('assign_booking', { p_booking_id: first, p_caregiver_id: verified.userId })
    expect(toActionResult(assigned.error)).toEqual({ ok: true })
    expectCode(await admin.client.rpc('assign_booking', { p_booking_id: first, p_caregiver_id: verified.userId }), 'BOOKING_NOT_REQUESTED')
    expectCode(await admin.client.rpc('change_booking_caregiver', { p_booking_id: first, p_caregiver_id: verified.userId }), 'SAME_CAREGIVER')
    expectCode(await admin.client.rpc('change_booking_caregiver', { p_booking_id: second, p_caregiver_id: verified.userId }), 'BOOKING_NOT_ASSIGNED')

    // the guard: the test above must trigger every code the mapping knows about
    expect([...seen].sort()).toEqual([...FUNCTION_ERROR_CODES].sort())
  })

  test('a call with no session is not a function code and never shows its text', async () => {
    const response = await anonClient().rpc('verify_caregiver', { p_caregiver_id: '00000000-0000-0000-0000-00000000dead', p_note: 'x' })
    expect(response.error).not.toBeNull()
    const result = toActionResult(response.error)
    expect(result).toEqual({ ok: false, code: 'UNKNOWN' })
    expect(describeActionError('UNKNOWN', 'verify').message).not.toContain(response.error!.message)
  })
})
