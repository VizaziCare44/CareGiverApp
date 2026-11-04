// seedVerification: the verification module of the test seed (DEV-051; Test_Data_Strategy.md
// §3.4, §7). On top of the accounts module it writes:
//   - the caregivers' verification history: Verified, Not verified (no rows), and
//     "removed" (a verified row, then a removed row: a Not-verified caregiver with a
//     history), so the Admin screens, Booking Detail states 3 and 4 and Remove Verified
//     all have data;
//   - assigned bookings, with assigned_by, assigned_at and the booking_assignments row,
//     exactly as assign_booking would have left them, and bookings in progress or
//     completed (FD-VISIT's check-in does not exist yet, so the seed makes them).
// What each caregiver and booking should be is data: VERIFICATION and ASSIGNMENTS in
// starter-set.mjs (a draft, see there). The Admin it acts as is admin1.
//
// Idempotent and append-only, like the tables it writes:
//   - history rows are only ever ADDED, one at a time and in order, to bring a caregiver to
//     the state asked for (a caregiver already there gets nothing, one who has been changed
//     since gets the row that puts them back); nothing is deleted;
//   - a booking is assigned only while it is still `requested`; one that has moved on is
//     left exactly as it is, apart from advancing an assigned booking to the status asked for.
// Needs the accounts module to have run first (it says so if an account is missing).

import { ASSIGNMENTS, BOOKINGS, RECIPIENTS, VERIFICATION } from './starter-set.mjs'
import { findAccountIds } from './accounts.mjs'
import { nairobiTime } from './dates.mjs'

async function latestActions(supabase, caregiverId) {
  const { data, error } = await supabase
    .from('caregiver_verifications')
    .select('action')
    .eq('caregiver_id', caregiverId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`could not read the verification history: ${error.message}`)
  return (data ?? []).map((row) => row.action)
}

async function appendHistory(supabase, caregiverId, adminId, action) {
  const note = action === 'verified' ? 'Seed: marked Verified' : 'Seed: Verified removed'
  const { error } = await supabase.from('caregiver_verifications').insert({ caregiver_id: caregiverId, action, note, acted_by: adminId })
  if (error) throw new Error(`could not write a ${action} row: ${error.message}`)
}

/** The starter-set bookings that exist, by key (B1 ...): id, status and caregiver. */
export async function findSeedBookings(supabase, ids) {
  const found = {}
  for (const booking of BOOKINGS) {
    const recipient = RECIPIENTS.find((r) => r.key === booking.recipient)
    const { data: recipientRow, error: recipientError } = await supabase
      .from('care_recipients')
      .select('id')
      .eq('account_id', ids[recipient.owner])
      .eq('name', recipient.name)
      .maybeSingle()
    if (recipientError) throw new Error(`could not look up ${recipient.name}: ${recipientError.message}`)
    if (!recipientRow) continue
    const { data, error } = await supabase
      .from('bookings')
      .select('id, status, assigned_caregiver_id')
      .eq('care_recipient_id', recipientRow.id)
      .eq('bundle_code', booking.bundle)
      .maybeSingle()
    if (error) throw new Error(`could not look up ${booking.key}: ${error.message}`)
    if (data) found[booking.key] = data
  }
  return found
}

export async function seedVerification({ supabase, now = new Date() }) {
  const summary = { verification: { appended: 0, left: 0 }, assignments: { assigned: 0, advanced: 0, left: 0 } }

  const ids = await findAccountIds(supabase)
  const needed = ['admin1', ...new Set([...VERIFICATION.map((v) => v.caregiver), ...ASSIGNMENTS.map((a) => a.caregiver)])]
  const missing = needed.filter((key) => !ids[key])
  if (missing.length > 0) throw new Error(`the accounts module has not run (missing: ${missing.join(', ')}); seed "accounts" first`)
  const adminId = ids.admin1

  for (const plan of VERIFICATION) {
    const caregiverId = ids[plan.caregiver]
    const actions = await latestActions(supabase, caregiverId)
    const latest = actions[actions.length - 1] ?? null
    const steps =
      plan.state === 'verified' ? (latest === 'verified' ? [] : ['verified']) :
      plan.state === 'removed' ? (latest === 'removed' ? [] : latest === 'verified' ? ['removed'] : ['verified', 'removed']) :
      []
    for (const action of steps) await appendHistory(supabase, caregiverId, adminId, action)
    summary.verification[steps.length > 0 ? 'appended' : 'left'] += steps.length > 0 ? steps.length : 1
  }

  const seedBookings = await findSeedBookings(supabase, ids)
  for (const plan of ASSIGNMENTS) {
    const booking = seedBookings[plan.booking]
    if (!booking) throw new Error(`booking ${plan.booking} is missing; seed "accounts" first`)
    const caregiverId = ids[plan.caregiver]
    const visit = plan.days === undefined ? null : nairobiTime({ days: plan.days, hour: plan.hour ?? 9, now }).toISOString()
    const advance = async () => {
      const update = { status: plan.status, ...(visit ? { requested_datetime: visit } : {}) }
      const { error } = await supabase.from('bookings').update(update).eq('id', booking.id)
      if (error) throw new Error(`could not move ${plan.booking} to ${plan.status}: ${error.message}`)
    }

    if (booking.status === 'requested') {
      // what assign_booking leaves: the booking assigned, who and when, and one assignment row
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'assigned', assigned_caregiver_id: caregiverId, assigned_by: adminId, assigned_at: now.toISOString() })
        .eq('id', booking.id)
        .eq('status', 'requested')
      if (error) throw new Error(`could not assign ${plan.booking}: ${error.message}`)
      const { error: rowError } = await supabase
        .from('booking_assignments')
        .insert({ booking_id: booking.id, caregiver_id: caregiverId, previous_caregiver_id: null, assigned_by: adminId })
      if (rowError) throw new Error(`could not write the assignment row of ${plan.booking}: ${rowError.message}`)
      summary.assignments.assigned += 1
      if (plan.status !== 'assigned' || visit) {
        await advance()
        if (plan.status !== 'assigned') summary.assignments.advanced += 1
      }
    } else if (booking.status === 'assigned' && booking.assigned_caregiver_id === caregiverId && plan.status !== 'assigned') {
      await advance()
      summary.assignments.advanced += 1
    } else {
      summary.assignments.left += 1
    }
  }

  return summary
}
