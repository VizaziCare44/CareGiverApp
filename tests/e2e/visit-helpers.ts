import { Client } from 'pg'
import { probe as probeVisits, type ProbeOffender } from '../../scripts/seed/probe.mjs'
import { serviceClient } from './helpers'

// DEV-070 items 3 and 5: the test clock and the read helpers for FD-VISIT tests.
//
// THE CLOCK (setClock, clearClock, countClockRows) is written through a DIRECT database
// connection, because the table is in the private schema, closed to every API role. It works on
// the local stack only: it refuses any other host, before it connects (a hosted project's
// database is never reachable from a test). The address is the local stack's, postgresql://
// postgres:postgres@127.0.0.1:54322/postgres, or E2E_DB_URL if that names a local host.
// A clock row belongs to one Caregiver (migration 0017): their calls see that moment as "now",
// and nobody else's do, so tests running in parallel do not disturb each other.
//
// THE READ HELPERS use the service role, for ground truth AFTER an attempt. They are never the
// caller of a permission case.

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]']
const DEFAULT_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** The database address for the clock, after checking it is the local stack. Throws otherwise. */
export function localDbUrl(): string {
  const url = process.env.E2E_DB_URL ?? DEFAULT_DB_URL
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('The test clock refuses to run: the database address is not a valid URL.')
  }
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(`The test clock refuses to run: ${host} is not the local stack. It only ever writes to localhost.`)
  }
  // and the API the tests talk to must be the local stack too, so the clock row and the calls meet in one database
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (api && !LOCAL_HOSTS.includes(new URL(api).hostname)) {
    throw new Error(`The test clock refuses to run: the tests are pointed at ${new URL(api).hostname}, not the local stack.`)
  }
  return url
}

async function withDb<T>(use: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: localDbUrl() })
  await client.connect()
  try {
    return await use(client)
  } finally {
    await client.end()
  }
}

/** From now on, this Caregiver's visit calls (check_in, log_visit_task, check_out, caregiver_visit) see `instant` as "now". */
export async function setClock(caregiver: { userId: string }, instant: Date | string) {
  const at = new Date(instant)
  if (Number.isNaN(at.getTime())) throw new Error('setClock: the instant is not a valid date.')
  await withDb((db) =>
    db.query(
      'insert into private.test_clock (caregiver_id, at) values ($1, $2) on conflict (caregiver_id) do update set at = excluded.at',
      [caregiver.userId, at.toISOString()],
    ),
  )
}

/** Back to the real time for this Caregiver. */
export async function clearClock(caregiver: { userId: string }) {
  await withDb((db) => db.query('delete from private.test_clock where caregiver_id = $1', [caregiver.userId]))
}

/** How many clock rows exist now. Zero at the end of a suite that cleaned up (TC-VIS-045). */
export async function countClockRows(): Promise<number> {
  return withDb(async (db) => Number((await db.query('select count(*) as n from private.test_clock')).rows[0].n))
}

/** Whether a clock row exists for this Caregiver. */
export async function hasClock(caregiver: { userId: string }): Promise<boolean> {
  return withDb(async (db) => (await db.query('select 1 from private.test_clock where caregiver_id = $1', [caregiver.userId])).rowCount === 1)
}

// ---------------------------------------------------------------------------
// Ground truth, read with the service role
// ---------------------------------------------------------------------------

export interface ChecklistItemRow {
  id: number
  bundle_code: 'medicheck' | 'doctors_day_out'
  sort_order: number
  name: string
  required: boolean
  note_required: boolean
}

export interface VisitRow {
  id: string
  booking_id: string
  caregiver_id: string
  checked_in_at: string
  checked_out_at: string | null
  visit_note: string | null
}

export interface VisitTaskRow {
  id: string
  visit_id: string
  checklist_item_id: number
  sort_order: number
  name: string
  required: boolean
  note_required: boolean
}

export interface EntryRow {
  id: number
  visit_task_id: string
  outcome: 'done' | 'not_done'
  note: string | null
  reason: string | null
  logged_at: string
}

/** The tasks of a bundle as the checklist has them now, in order. */
export async function getChecklistItems(bundle: ChecklistItemRow['bundle_code']): Promise<ChecklistItemRow[]> {
  const { data, error } = await serviceClient().from('checklist_items').select('*').eq('bundle_code', bundle).order('sort_order', { ascending: true })
  if (error) throw new Error(`getChecklistItems failed: ${error.message}`)
  return (data ?? []) as ChecklistItemRow[]
}

/** The visit of a booking, or null if it has none. */
export async function getVisit(bookingId: string): Promise<VisitRow | null> {
  const { data, error } = await serviceClient().from('visits').select('*').eq('booking_id', bookingId).maybeSingle()
  if (error) throw new Error(`getVisit failed: ${error.message}`)
  return (data as VisitRow | null) ?? null
}

/** The snapshot of a visit's tasks, in order. */
export async function getVisitTasks(visitId: string): Promise<VisitTaskRow[]> {
  const { data, error } = await serviceClient().from('visit_tasks').select('*').eq('visit_id', visitId).order('sort_order', { ascending: true })
  if (error) throw new Error(`getVisitTasks failed: ${error.message}`)
  return (data ?? []) as VisitTaskRow[]
}

/** Every entry of a task, oldest first; the last one is the one that counts. */
export async function getEntries(visitTaskId: string): Promise<EntryRow[]> {
  const { data, error } = await serviceClient().from('visit_task_entries').select('*').eq('visit_task_id', visitTaskId).order('id', { ascending: true })
  if (error) throw new Error(`getEntries failed: ${error.message}`)
  return (data ?? []) as EntryRow[]
}

/** The offenders of §7.3 item 13: rows that break a rule the visit functions and triggers keep. Empty is a pass. */
export function probe(options?: { bookingIds?: string[] }): Promise<ProbeOffender[]> {
  return probeVisits(serviceClient(), options)
}
