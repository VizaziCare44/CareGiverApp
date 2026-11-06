// seedVisit: the visit module of the test seed (DEV-070 item 1; Test_Data_Strategy.md §3.3, §3.4,
// §7). On top of the accounts and verification modules it gives B6 (in progress, cg2) its visit row,
// its snapshot of the checklist and a partly logged set, and B7 (completed, cg1) a full set of
// entries, a note about the visit and both times. What is written is data: VISITS in
// starter-set.mjs.
//
// It writes with the service role, in a fixed order, because the triggers bind every role (migration
// 0011, rebuilt by 0020): the open visit row; the snapshot rows; the entries, in the order they were logged; for B7
// the closing update (an entry cannot be added to a closed visit, and a closed visit cannot be
// updated); and the booking's status last. It never goes through check_in, log_visit_task or
// check_out, so it can put the times where the plan says (inside the booked day, in the past)
// without the test clock.
//
// Idempotent and append-only, like the tables it writes: a booking that already has a visit is left
// exactly as it is, apart from the booking's status being put right. Nothing is deleted or updated
// except the one closing update of a visit this run opened. Needs the accounts and verification
// modules first (it says so if a booking is missing or not the caregiver's), and migration 0020
// (the visit tables in the shape of FD-VISIT 7.2).
//
// The probe (probe.mjs) passes for B6 and B7 after it.

import { VISITS } from './starter-set.mjs'
import { findAccountIds } from './accounts.mjs'
import { findSeedBookings } from './verification.mjs'
import { nairobiOnDayOf } from './dates.mjs'
import { probe } from './probe.mjs'

const fail = (message) => {
  throw new Error(message)
}

export async function seedVisit({ supabase }) {
  const summary = { visits: { created: 0, closed: 0, entries: 0, left: 0 }, statuses: { corrected: 0 } }

  const ids = await findAccountIds(supabase)
  const missing = [...new Set(VISITS.map((v) => v.caregiver))].filter((key) => !ids[key])
  if (missing.length > 0) fail(`the accounts module has not run (missing: ${missing.join(', ')}); seed "accounts" and "verification" first`)
  const bookings = await findSeedBookings(supabase, ids)

  for (const plan of VISITS) {
    const booking = bookings[plan.booking]
    if (!booking) fail(`booking ${plan.booking} is missing; seed "accounts" and "verification" first`)
    if (booking.assigned_caregiver_id !== ids[plan.caregiver]) {
      fail(`booking ${plan.booking} is not assigned to ${plan.caregiver}; seed "verification" first (it assigns it)`)
    }

    const wantedStatus = plan.checkedOut ? 'completed' : 'in_progress'
    const { data: existing, error: existingError } = await supabase.from('visits').select('id').eq('booking_id', booking.id).maybeSingle()
    if (existingError) fail(`could not look up the visit of ${plan.booking}: ${existingError.message}`)

    if (!existing) {
      const { data: bookingRow, error: bookingError } = await supabase.from('bookings').select('requested_datetime, bundle_code').eq('id', booking.id).single()
      if (bookingError || !bookingRow) fail(`could not read ${plan.booking}: ${bookingError?.message}`)
      const at = ({ h, m }) => nairobiOnDayOf(bookingRow.requested_datetime, { hour: h, minute: m })

      // 1. the open visit row
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({ booking_id: booking.id, caregiver_id: ids[plan.caregiver], checked_in_at: at(plan.checkedIn).toISOString() })
        .select('id')
        .single()
      if (visitError || !visit) fail(`could not open the visit of ${plan.booking}: ${visitError?.message}`)

      // 2. the snapshot: the bundle's checklist as it is now
      const { data: items, error: itemsError } = await supabase
        .from('checklist_items')
        .select('task_key, sort_order, name, is_required, note_required_for_done')
        .eq('bundle_code', bookingRow.bundle_code)
        .order('sort_order', { ascending: true })
      if (itemsError || !items || items.length === 0) fail(`could not read the checklist of ${plan.booking}: ${itemsError?.message ?? 'it is empty'}`)
      const { data: tasks, error: tasksError } = await supabase
        .from('visit_tasks')
        .insert(items.map((item) => ({ visit_id: visit.id, task_key: item.task_key, name: item.name, sort_order: item.sort_order, is_required: item.is_required, note_required_for_done: item.note_required_for_done })))
        .select('id, name')
      if (tasksError || !tasks) fail(`could not write the tasks of ${plan.booking}: ${tasksError?.message}`)
      const taskId = new Map(tasks.map((task) => [task.name, task.id]))

      // 3. the entries, one at a time and in the order they were logged (the highest id counts)
      for (const entry of plan.entries) {
        const task = taskId.get(entry.task)
        if (!task) fail(`${plan.booking} has no task called "${entry.task}" (the checklist has: ${[...taskId.keys()].join(', ')})`)
        const { error } = await supabase.from('visit_task_entries').insert({
          visit_task_id: task,
          logged_by: ids[plan.caregiver],
          outcome: entry.outcome,
          note: entry.outcome === 'done' ? (entry.note ?? null) : null,
          reason: entry.outcome === 'not_done' ? (entry.reason ?? null) : null,
          logged_at: at(entry.at).toISOString(),
        })
        if (error) fail(`could not write an entry of ${plan.booking} (${entry.task}): ${error.message}`)
        summary.visits.entries += 1
      }

      // 4. the closing update (B7)
      if (plan.checkedOut) {
        const { error } = await supabase.from('visits').update({ checked_out_at: at(plan.checkedOut).toISOString(), visit_note: plan.visitNote }).eq('id', visit.id)
        if (error) fail(`could not close the visit of ${plan.booking}: ${error.message}`)
        summary.visits.closed += 1
      }
      summary.visits.created += 1
    } else {
      summary.visits.left += 1
    }

    // 5. the booking's status, last
    if (booking.status !== wantedStatus) {
      const { error } = await supabase.from('bookings').update({ status: wantedStatus }).eq('id', booking.id)
      if (error) fail(`could not move ${plan.booking} to ${wantedStatus}: ${error.message}`)
      summary.statuses.corrected += 1
    }
  }

  // the probe of §7.3 item 13 passes for what this module wrote
  const offenders = await probe(supabase, { bookingIds: VISITS.map((plan) => bookings[plan.booking].id) })
  if (offenders.length > 0) fail(`the probe found problems after seeding the visits: ${JSON.stringify(offenders)}`)
  return summary
}
