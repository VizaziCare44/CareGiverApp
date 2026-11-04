import type { SupabaseClient } from '@supabase/supabase-js'
import { TEST_PASSWORD, anonClient, serviceClient } from './helpers'

// Test factories (Test_Data_Strategy.md §5, §7; DEV-055 base form, extended for
// FD-VERIFY by DEV-051). Each makes the rows one test needs, stamped with a unique
// `e2e-<random>@test.vizazicare.example` tag so runs never collide, and returns
// what the test needs to check them.
//
// They use the service-role connection to SET UP data only. A permission case
// must still read and act through a real session (the `client` each user comes
// back with), never through the service role.
//
// What they deliberately do not do is go through assign_booking or
// verify_caregiver: a factory has to be able to build states those functions
// refuse to produce (a booking whose caregiver has since lost Verified). The rows
// they write are the ones the real functions would have written; factories.spec.ts
// checks that against the real functions.
//
// THE ONE EXCEPTION IS A VISIT (DEV-070). makeVisit, and so makeBooking with the
// status in_progress or completed, goes through the real check_in, log_visit_task
// and check_out as the caregiver's own session, never the service role, so the
// rules are the rules. For that the booking must be dated today in Nairobi (the
// default), or the test clock must be set for the caregiver (setClock in
// visit-helpers.ts); otherwise it stops with a clear message and does not fall
// back to inserting rows. Only ONE visit can be open per caregiver (BR-007), so a
// test that needs an open visit uses a fresh makeCaregiver. Tests that check in,
// log or check out use a factory booking and caregiver, never the starter set's
// B1 to B8 (Test_Data_Strategy.md §5).

import { getVisit, getVisitTasks, hasClock } from './visit-helpers'

export const TEST_EMAIL_DOMAIN = 'test.vizazicare.example'

/** A short unique tag: time plus randomness, lower-case letters and digits only. */
export function uniqueTag() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export const testEmail = (tag = uniqueTag()) => `e2e-${tag}@${TEST_EMAIL_DOMAIN}`

type Role = 'admin' | 'family_member' | 'caregiver'

export interface TestUser {
  userId: string
  email: string
  password: string
  fullName: string
  /** A signed-in session as this user: use it for permission cases. */
  client: SupabaseClient
}

async function makeUser(role: Role, fullName: string): Promise<TestUser> {
  const email = testEmail()
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: '+254700000030' },
    // the role is set the way the provisioning script does it: app_metadata, service role only
    ...(role === 'family_member' ? {} : { app_metadata: { role } }),
  })
  if (error || !data.user) throw new Error(`makeUser(${role}) failed: ${error?.message}`)
  const client = anonClient()
  const signedIn = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (signedIn.error) throw new Error(`makeUser(${role}) sign-in failed: ${signedIn.error.message}`)
  return { userId: data.user.id, email, password: TEST_PASSWORD, fullName, client }
}

export const makeFamily = (fullName = `Family ${uniqueTag()}`) => makeUser('family_member', fullName)
export const makeAdmin = (fullName = `Admin ${uniqueTag()}`) => makeUser('admin', fullName)

// the Admin the factories attribute history and assignments to (acted_by,
// assigned_by); one per worker, made the first time it is needed
let sharedAdmin: Promise<TestUser> | null = null
export const factoryAdmin = () => (sharedAdmin ??= makeAdmin('Factory Admin'))

// ---------------------------------------------------------------------------
// Caregivers and their Verified history
// ---------------------------------------------------------------------------

export type VerifiedState = true | false | 'removed'

export interface HistoryRow {
  id: string
  action: 'verified' | 'removed'
  created_at: string
}

export interface TestCaregiver extends TestUser {
  verified: VerifiedState
  history: HistoryRow[]
}

/**
 * A Caregiver account. `verified`:
 *   true      one `verified` history row (currently Verified)
 *   false     no history rows (never Verified; the default)
 *   'removed' a `verified` row, then a `removed` row: Not verified,
 *             with a history (the states behind Booking Detail states 3 and 4,
 *             and the Remove Verified cases)
 * Rows are written one at a time, in order, so each gets a later `created_at`
 * (clock_timestamp()), and that is what the database orders the history by. (The
 * ids are random UUIDs, so they do not increase; only `created_at` does.)
 */
export async function makeCaregiver({ verified = false, fullName }: { verified?: VerifiedState; fullName?: string } = {}): Promise<TestCaregiver> {
  const caregiver = await makeUser('caregiver', fullName ?? `Caregiver ${uniqueTag()}`)
  const admin = await factoryAdmin()
  const actions: HistoryRow['action'][] = verified === true ? ['verified'] : verified === 'removed' ? ['verified', 'removed'] : []

  const history: HistoryRow[] = []
  for (const action of actions) {
    const { data, error } = await serviceClient()
      .from('caregiver_verifications')
      .insert({
        caregiver_id: caregiver.userId,
        action,
        note: action === 'verified' ? 'Factory: marked Verified' : 'Factory: Verified removed',
        acted_by: admin.userId,
      })
      .select('id, action, created_at')
      .single()
    if (error || !data) throw new Error(`makeCaregiver history failed: ${error?.message}`)
    history.push(data as HistoryRow)
  }
  return { ...caregiver, verified, history }
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

export interface TestRecipient {
  id: string
  name: string
  careNotes: string | null
  /**
   * A string that appears in the care notes and nowhere else, so a test can prove
   * the notes are gone from a page or an API response (AC-021): search for it.
   * For care notes the test supplies, it is that text; null when there are none.
   */
  marker: string | null
}

/**
 * A care recipient of `family`. By default the care notes carry a unique marker
 * string, returned to the test. Pass `careNotes` to use your own text verbatim
 * (the marker is then that text), or `null` for no care notes.
 */
export async function makeRecipient({ family, name, careNotes }: { family: TestUser; name?: string; careNotes?: string | null }): Promise<TestRecipient> {
  const tag = uniqueTag()
  const marker = careNotes === undefined ? `CARENOTE-${tag}` : careNotes
  const notes = careNotes === undefined ? `Takes tablets with breakfast. ${marker}` : careNotes
  const recipientName = name ?? `Recipient ${tag}`
  const { data, error } = await serviceClient()
    .from('care_recipients')
    .insert({ account_id: family.userId, name: recipientName, care_notes: notes })
    .select('id')
    .single()
  if (error || !data) throw new Error(`makeRecipient failed: ${error?.message}`)
  return { id: data.id as string, name: recipientName, careNotes: notes, marker }
}

// ---------------------------------------------------------------------------
// Dates, in Africa/Nairobi (§7.8(k), DECIDED by the founder)
// ---------------------------------------------------------------------------

/** Nairobi is UTC+3 all year: there is no daylight saving. */
export const NAIROBI_OFFSET_HOURS = 3

/**
 * The instant at `hour`:`minute` Nairobi time, `days` days after today's date IN
 * NAIROBI (which is not always today's date in UTC: from 21:00 UTC it is already
 * tomorrow there). So two calls with the same `days` are on one Nairobi day, at
 * the hours given. `now` is for tests of this function itself.
 */
export function nairobiTime({ days = 0, hour = 9, minute = 0, now = new Date() }: { days?: number; hour?: number; minute?: number; now?: Date } = {}) {
  const parts: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)) {
    parts[part.type] = part.value
  }
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + days, hour - NAIROBI_OFFSET_HOURS, minute))
}

/** Day offsets for nairobiDay: yesterday, today and tomorrow in Nairobi. */
export const yesterday = -1
export const today = 0
export const tomorrow = 1

/**
 * The instant of the Nairobi calendar day `offsetDays` from today, at `time` ('HH:MM', default
 * '09:00' EAT). Computed in Africa/Nairobi, not in UTC, so it is right at the UTC date change
 * (21:00 UTC is already tomorrow there). It needs no clock. `now` is for tests of this function.
 */
export function nairobiDay(offsetDays = today, time = '09:00', now = new Date()) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error(`nairobiDay: "${time}" is not a time like "09:00"`)
  return nairobiTime({ days: offsetDays, hour: Number(match[1]), minute: Number(match[2]), now })
}

/** The Nairobi calendar date (YYYY-MM-DD) of an instant. */
const nairobiDate = (instant: Date | string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export type BookingStatus = 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'

export interface TestBooking {
  id: string
  status: BookingStatus
  recipient: TestRecipient
  bundle: 'medicheck' | 'doctors_day_out'
  /** The visit, an ISO instant. */
  visit: string
  caregiverId: string | null
  assignedBy: string | null
  assignedAt: string | null
  /** The visit row, for a booking made in progress or completed; null otherwise. */
  visitId: string | null
}

/**
 * A booking of `family`, in any status. The status/caregiver rule the database
 * enforces (bookings_status_caregiver_check) is respected, and refused here with a
 * clearer message:
 *   requested                      no caregiver
 *   assigned, in_progress, completed   a caregiver
 *   cancelled                      with or without one
 * With a caregiver it writes `assigned_by`, `assigned_at` and the matching
 * `booking_assignments` row (previous caregiver none), as assign_booking would have.
 * It does not check that the caregiver is Verified: building a booking whose
 * caregiver has since lost Verified is the point.
 *
 * in_progress and completed (DEV-070) make the booking assigned and then the visit through
 * makeVisit, so the real check_in (and, for completed, log_visit_task and check_out) run as the
 * caregiver's own session: the caregiver must be a makeCaregiver result and Verified, and the
 * visit defaults to today 09:00 in Nairobi, because check-in is possible only on the day (or
 * with a clock set for the caregiver). A completed visit has its Required tasks logged Done.
 */
export async function makeBooking({
  family,
  recipient,
  bundle = 'medicheck',
  status = 'requested',
  caregiver,
  visit,
  assignedBy,
  assignedAt,
}: {
  family: TestUser
  recipient?: TestRecipient
  bundle?: TestBooking['bundle']
  status?: BookingStatus
  caregiver?: { userId: string; client?: SupabaseClient }
  visit?: Date | string
  assignedBy?: { userId: string }
  assignedAt?: Date | string
}): Promise<TestBooking> {
  const needsCaregiver = status === 'assigned' || status === 'in_progress' || status === 'completed'
  if (needsCaregiver && !caregiver) throw new Error(`makeBooking: a "${status}" booking needs a caregiver (the status/caregiver rule)`)
  if (status === 'requested' && caregiver) throw new Error('makeBooking: a "requested" booking has no caregiver (the status/caregiver rule)')

  const bookedRecipient = recipient ?? (await makeRecipient({ family }))
  const hasVisit = status === 'in_progress' || status === 'completed'
  if (hasVisit && !caregiver?.client) throw new Error(`makeBooking: a "${status}" booking is checked in through the real check_in, so the caregiver must be a makeCaregiver result (it needs its own session)`)
  const visitAt = new Date(visit ?? (hasVisit ? nairobiDay(today) : nairobiTime({ days: 3, hour: 9 }))).toISOString()
  const admin = caregiver ? (assignedBy ?? (await factoryAdmin())) : null
  const assignedAtIso = caregiver ? new Date(assignedAt ?? new Date()).toISOString() : null

  const { data, error } = await serviceClient()
    .from('bookings')
    .insert({
      account_id: family.userId,
      care_recipient_id: bookedRecipient.id,
      bundle_code: bundle,
      requested_datetime: visitAt,
      status: hasVisit ? 'assigned' : status,
      assigned_caregiver_id: caregiver?.userId ?? null,
      assigned_by: admin?.userId ?? null,
      assigned_at: assignedAtIso,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`makeBooking failed: ${error?.message}`)

  if (caregiver && admin) {
    const assignment = await serviceClient()
      .from('booking_assignments')
      .insert({ booking_id: data.id, caregiver_id: caregiver.userId, previous_caregiver_id: null, assigned_by: admin.userId })
    if (assignment.error) throw new Error(`makeBooking assignment row failed: ${assignment.error.message}`)
  }

  let visitId: string | null = null
  if (hasVisit) {
    const made = await makeVisit({ booking: { id: data.id as string, visit: visitAt }, caregiver: caregiver as { userId: string; client: SupabaseClient }, closed: status === 'completed' })
    visitId = made.id
  }

  return {
    id: data.id as string,
    status,
    recipient: bookedRecipient,
    bundle,
    visit: visitAt,
    caregiverId: caregiver?.userId ?? null,
    assignedBy: admin?.userId ?? null,
    assignedAt: assignedAtIso,
    visitId,
  }
}

// ---------------------------------------------------------------------------
// Visits (DEV-070 item 2)
// ---------------------------------------------------------------------------

/** One task already logged: `key` is the task's name as the checklist has it ("Vitals check"). */
export interface VisitTaskPlan {
  key: string
  outcome: 'done' | 'not_done'
  note?: string
  reason?: string
}

export interface TestVisit {
  id: string
  bookingId: string
  checkedInAt: string
  checkedOutAt: string | null
  visitNote: string | null
}

/**
 * A visit, made the way a Caregiver makes one: the real check_in, then the real log_visit_task for
 * each of `tasks`, and with `closed` also the real check_out (with `visitNote`), all through the
 * caregiver's own session and never the service role. So the rules are the rules, and what is
 * refused is refused with the function's own message.
 *
 * It needs the booking to be assigned to this caregiver, who must be Verified, and the day to be
 * right: the booking is dated today in Nairobi, or a test clock is set for the caregiver
 * (setClock). Otherwise it stops with a clear message and does NOT fall back to inserting rows.
 * A caregiver can have only one visit open (BR-007), so use a fresh makeCaregiver for each open
 * visit.
 *
 * `closed` logs Done, with a one-line note, any Required task that `tasks` does not cover (the
 * real check_out refuses a visit with a Required task unlogged); the Optional task is left alone.
 */
export async function makeVisit({
  booking,
  caregiver,
  tasks = [],
  closed = false,
  visitNote,
}: {
  booking: { id: string; visit: Date | string }
  caregiver: { userId: string; client: SupabaseClient }
  tasks?: VisitTaskPlan[]
  closed?: boolean
  visitNote?: string
}): Promise<TestVisit> {
  if (!caregiver.client) throw new Error('makeVisit: the caregiver needs its own session (a makeCaregiver result): the visit is made through the caregiver calls, never the service role')

  const bookedDay = nairobiDate(booking.visit)
  if (bookedDay !== nairobiDate(new Date()) && !(await hasClock(caregiver))) {
    throw new Error(
      `makeVisit: the booking is dated ${bookedDay} (Nairobi), not today (${nairobiDate(new Date())}), and no test clock is set for this caregiver, so check_in would refuse it. ` +
        'Date the booking today (nairobiDay(today)) or call setClock(caregiver, instant) first. makeVisit never falls back to inserting rows.',
    )
  }

  const checkedIn = await caregiver.client.rpc('check_in', { p_booking_id: booking.id })
  if (checkedIn.error) throw new Error(`makeVisit: check_in refused: ${checkedIn.error.message}`)
  const visit = await getVisit(booking.id)
  if (!visit) throw new Error('makeVisit: check_in succeeded but there is no visit row')
  const snapshot = await getVisitTasks(visit.id)
  const taskIdOf = (key: string) => {
    const task = snapshot.find((t) => t.name === key)
    if (!task) throw new Error(`makeVisit: this visit has no task "${key}" (it has: ${snapshot.map((t) => t.name).join(', ')})`)
    return task.id
  }

  const log = async (plan: VisitTaskPlan) => {
    const result = await caregiver.client.rpc('log_visit_task', {
      p_task_id: taskIdOf(plan.key),
      p_outcome: plan.outcome,
      p_note: plan.outcome === 'done' ? (plan.note ?? null) : null,
      p_reason: plan.outcome === 'not_done' ? (plan.reason ?? null) : null,
    })
    if (result.error) throw new Error(`makeVisit: log_visit_task refused "${plan.key}": ${result.error.message}`)
  }
  for (const plan of tasks) await log(plan)

  if (closed) {
    for (const task of snapshot.filter((t) => t.required && !tasks.some((plan) => plan.key === t.name))) {
      await log({ key: task.name, outcome: 'done', note: 'Factory: done' })
    }
    const out = await caregiver.client.rpc('check_out', { p_booking_id: booking.id, p_visit_note: visitNote ?? '' })
    if (out.error) throw new Error(`makeVisit: check_out refused: ${out.error.message}`)
  }

  const made = await getVisit(booking.id)
  return { id: made!.id, bookingId: booking.id, checkedInAt: made!.checked_in_at, checkedOutAt: made!.checked_out_at, visitNote: made!.visit_note }
}
