import type { SupabaseClient } from '@supabase/supabase-js'
import type { FamilyBookingStatus } from '@/lib/bookings/status-label'
import type { FamilyVisitRow, FamilyVisitTaskRow, VisitReads } from '@/lib/visits/family-visit'

// The visit reads of the family's Booking Detail (DEV-075), server side. They go through the family's
// own session and only through family_visit and family_visit_tasks (DEV-073); a failure is returned as
// `ok: false`, never thrown and never with the database's message, so the page can show its own
// "couldn't load" state in place of the visit block and keep the rest of the page (DEV-050).

export type VisitRowRead = { ok: true; visit: FamilyVisitRow | null } | { ok: false }

/** The family_visit row of a booking: null when there is none. */
export async function readVisitRow(supabase: SupabaseClient, bookingId: string): Promise<VisitRowRead> {
  try {
    const { data, error } = await supabase
      .from('family_visit')
      .select('booking_id, checked_in_at, checked_out_at, visit_note')
      .eq('booking_id', bookingId)
      .maybeSingle()
    if (error) return { ok: false }
    return { ok: true, visit: (data as FamilyVisitRow | null) ?? null }
  } catch {
    return { ok: false }
  }
}

/** The tasks, read only for a completed booking whose visit has a check-out time. */
export async function readVisitTasks(supabase: SupabaseClient, bookingId: string): Promise<{ ok: true; tasks: FamilyVisitTaskRow[] } | { ok: false }> {
  try {
    const { data, error } = await supabase
      .from('family_visit_tasks')
      .select('booking_id, sort_order, name, outcome, logged_at, reason, note')
      .eq('booking_id', bookingId)
      .order('sort_order', { ascending: true })
    if (error) return { ok: false }
    return { ok: true, tasks: (data ?? []) as FamilyVisitTaskRow[] }
  } catch {
    return { ok: false }
  }
}

/** Puts a visit row read and (when it is needed) a tasks read together into what the block works from. */
export async function finishVisitReads(supabase: SupabaseClient, bookingId: string, status: FamilyBookingStatus, row: VisitRowRead): Promise<VisitReads> {
  if (!row.ok) return { ok: false, visit: null, tasks: [] }
  if (status !== 'completed' || !row.visit?.checked_out_at) return { ok: true, visit: row.visit, tasks: [] }
  const tasks = await readVisitTasks(supabase, bookingId)
  if (!tasks.ok) return { ok: false, visit: row.visit, tasks: [] }
  return { ok: true, visit: row.visit, tasks: tasks.tasks }
}
