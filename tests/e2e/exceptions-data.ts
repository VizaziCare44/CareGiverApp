import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from './helpers'
import {
  makeAdmin,
  makeBooking,
  makeCaregiver,
  makeFamily,
  makeRecipient,
  makeVisit,
  uniqueTag,
  type TestCaregiver,
  type TestUser,
  type VisitTaskPlan,
} from './factories'
import { clearClock, localDbUrl, setClock } from './visit-helpers'

// DEV-081: the test data for the Admin's Exceptions (FD-ADMINEXC §9, §10; Test_Data_Strategy.md §5, §7
// seedAdminExceptions). There is no starter data: every case is built per test with the factories, and
// `makeExceptionAdmin` gives each test an Admin of its own whose clock row is set and cleared by that test
// only, so no test uses admin1 or moves another persona's time.
//
// The boundary cases (30:01, 119/120 minutes, 47/48 hours, an early check-in) need the test clock, which is
// written through a direct database connection and so exists on the local stack only. Elsewhere they are
// skipped and reported as not covered, never as passed (`exceptionsLocal`).
//
// A visit is made the way a Caregiver makes one: the real check_in, log_visit_task and check_out through the
// caregiver's own session, with that caregiver's clock set to the instant wanted. A state the app cannot produce
// (a booking marked completed with no visit row, E6) is set up with the service role as set-up only, never as the
// caller, and put back afterwards (setStatus back to 'assigned'), so the probe of FD-VISIT 7.3 item 13 returns
// nothing at the end of the suite.

export const exceptionsLocal = (() => {
  try {
    localDbUrl()
    return true
  } catch {
    return false
  }
})()

export interface ExceptionAdmin extends TestUser {
  /** From now on this Admin's reads see `instant` as "now" (their own clock row; nobody else's time moves). */
  setNow(instant: Date | string): Promise<void>
  /** Back to the real time. */
  clearNow(): Promise<void>
}

/** A new Admin with a clock row of its own, set and cleared by the tests that use it. */
export async function makeExceptionAdmin(): Promise<ExceptionAdmin> {
  const admin = await makeAdmin(`Exceptions Admin ${uniqueTag()}`)
  return {
    ...admin,
    setNow: (instant) => setClock({ userId: admin.userId }, instant),
    clearNow: () => clearClock({ userId: admin.userId }),
  }
}

export const minutes = (count: number) => count * 60 * 1000
export const hours = (count: number) => count * 60 * minutes(1)
export const plus = (instant: Date, milliseconds: number) => new Date(instant.getTime() + milliseconds)

export interface ExceptionBooking {
  id: string
  /** Unique, so a screen test can find the row by text */
  recipientName: string
  requested: Date
  family: TestUser
  caregiver: TestCaregiver
}

/** An assigned booking, requested at `requested`, with a Verified caregiver of its own (one open visit at a time). */
export async function makeExceptionBooking({
  requested,
  bundle = 'medicheck',
  caregiver,
  recipientName,
  careNotes,
  family,
}: {
  requested: Date
  bundle?: 'medicheck' | 'doctors_day_out'
  caregiver?: TestCaregiver
  recipientName?: string
  careNotes?: string | null
  family?: TestUser
}): Promise<ExceptionBooking> {
  const owner = family ?? (await makeFamily())
  const assigned = caregiver ?? (await makeCaregiver({ verified: true }))
  const name = recipientName ?? `Exc ${uniqueTag()}`
  const recipient = await makeRecipient({ family: owner, name, careNotes })
  const booking = await makeBooking({ family: owner, recipient, bundle, status: 'assigned', caregiver: assigned, visit: requested })
  return { id: booking.id, recipientName: name, requested, family: owner, caregiver: assigned }
}

/**
 * The caregiver checks in at `at` (their clock is set to that instant, then cleared), logs the tasks in `tasks`
 * and, with `closed`, logs the other Required tasks Done and checks out at the same instant. Returns the visit id.
 */
export async function checkInAt(
  booking: ExceptionBooking,
  at: Date,
  { tasks = [], closed = false, visitNote }: { tasks?: VisitTaskPlan[]; closed?: boolean; visitNote?: string } = {},
) {
  await setClock(booking.caregiver, at)
  try {
    return await makeVisit({ booking: { id: booking.id, visit: booking.requested }, caregiver: booking.caregiver, tasks, closed, visitNote })
  } finally {
    await clearClock(booking.caregiver)
  }
}

/** The caregiver does something at `at` (their clock is set to that instant for the call, then cleared). */
export async function asCaregiverAt<T>(booking: ExceptionBooking, at: Date, call: (client: SupabaseClient) => PromiseLike<T>) {
  await setClock(booking.caregiver, at)
  try {
    return await call(booking.caregiver.client)
  } finally {
    await clearClock(booking.caregiver)
  }
}

/** Set-up only, with the service role: a state the app cannot make (E6). */
export async function setStatus(bookingId: string, status: 'assigned' | 'in_progress' | 'completed') {
  const result = await serviceClient().from('bookings').update({ status }).eq('id', bookingId)
  if (result.error) throw new Error(`setStatus failed: ${result.error.message}`)
}

/** The Admin removes the caregiver's Verified status through the real function. */
export async function removeVerified(admin: ExceptionAdmin, caregiver: TestCaregiver) {
  const result = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: caregiver.userId, p_note: 'Exceptions test' })
  if (result.error) throw new Error(`removeVerified failed: ${result.error.message}`)
}

export interface ViewRow {
  booking_id: string
  requested_datetime: string
  bundle_code: string
  recipient_name: string
  caregiver_name: string | null
  status: string
  e1_no_check_in: boolean
  e2_late_check_in: boolean
  e3_check_out_outstanding: boolean
  e4_required_task_not_done: boolean
  e5_caregiver_not_verified: boolean
  e6_visit_record_missing: boolean
  minutes_since_requested: number | null
  minutes_late: number | null
  minutes_since_check_in: number | null
  not_done_tasks: { name: string; reason: string | null }[] | null
}

/** The Admin's own read of the view for the given bookings (the shared database holds other tests' rows too). */
export async function exceptionsFor(admin: { client: SupabaseClient }, ...bookingIds: string[]): Promise<ViewRow[]> {
  const { data, error } = await admin.client.from('admin_exceptions').select('*').in('booking_id', bookingIds)
  if (error) throw new Error(`reading admin_exceptions failed: ${error.message}`)
  return (data ?? []) as ViewRow[]
}

/** The flags that are true on a row, as the labels used in the tests: 'e1' to 'e6'. */
export const flagsOf = (row: ViewRow) =>
  (['e1_no_check_in', 'e2_late_check_in', 'e3_check_out_outstanding', 'e4_required_task_not_done', 'e5_caregiver_not_verified', 'e6_visit_record_missing'] as const)
    .map((key, index) => (row[key] ? `e${index + 1}` : null))
    .filter((flag): flag is string => flag !== null)
