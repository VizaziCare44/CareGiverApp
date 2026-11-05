// The family's view of a visit (DEV-075; FD-FAMVIS §6.1, §7.3): what the page reads from
// family_visit and family_visit_tasks (DEV-073) and the one rule that chooses what the visit block
// shows. DRAFT: the state table of §7.3 was not available; the states are the ones DEV-075 names
// (F1 to F6) and this function is where they are decided, so a correction is an edit here.

import { BUNDLES } from '@/lib/bookings/bundles'
import type { FamilyBookingStatus } from '@/lib/bookings/status-label'
import type { BundleCode } from '@/lib/bookings/types'

export interface FamilyVisitRow {
  booking_id: string
  checked_in_at: string
  checked_out_at: string | null
  visit_note: string | null
}

export interface FamilyVisitTaskRow {
  booking_id: string
  sort_order: number
  name: string
  outcome: 'done' | 'not_done' | 'not_recorded'
  logged_at: string | null
  reason: string | null
  note: string | null
}

/** What the visit reads gave. `ok` is false if ANY read failed; nothing else is then trusted. */
export interface VisitReads {
  ok: boolean
  visit: FamilyVisitRow | null
  tasks: FamilyVisitTaskRow[]
}

/**
 *   none           no visit block (F1 and F6: not started, cancelled; and an in-progress booking with no visit
 *                  row, which only test data can make)
 *   in-progress    F2: "Visit", "Checked in at" and the fixed line; no task, outcome, reason or note
 *   not-available  F4: completed, and there is no visit row at all
 *   error          F5: a read failed; or a completed booking whose visit has no check-out time (decision 15,
 *                  FD-FAMVIS §15); or a closed visit with no task rows
 *   report         F3: completed, closed, with its tasks (the report itself is DEV-076)
 */
export type FamilyVisitState = 'none' | 'in-progress' | 'not-available' | 'error' | 'report'

export function familyVisitState(status: FamilyBookingStatus, reads: VisitReads): FamilyVisitState {
  if (status !== 'in_progress' && status !== 'completed') return 'none'
  if (!reads.ok) return 'error'

  if (status === 'in_progress') return reads.visit ? 'in-progress' : 'none'

  if (!reads.visit) return 'not-available'
  if (!reads.visit.checked_out_at) return 'error'
  if (reads.tasks.length === 0) return 'error'
  return 'report'
}

/**
 * What the visit block is handed. For a visit in progress only the check-in time goes to the browser:
 * whatever else came back (a closing time, a note, task rows) is dropped here, so it never leaves the
 * server and the block cannot show it (F2: "no task, outcome, reason or note, whatever came back").
 */
export function readsForBlock(status: FamilyBookingStatus, reads: VisitReads): VisitReads {
  if (status === 'in_progress' && reads.visit) {
    return { ok: reads.ok, visit: { ...reads.visit, checked_out_at: null, visit_note: null }, tasks: [] }
  }
  return reads
}

/** The title of the report card: "MediCheck Report" or "Clinic Visit Report" (the bundle's report name). */
export function reportTitle(bundle: BundleCode): string {
  return BUNDLES[bundle].reportName
}
