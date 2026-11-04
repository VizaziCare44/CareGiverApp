import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppBar } from '@/components/ui/app-bar'
import { ActionLink } from '@/components/ui/action-button'
import { CheckInBar } from '@/components/caregiver/check-in-bar'
import { ContactAddressRow, ContactEmailLink } from '@/components/caregiver/missing-booking-help'
import { Notice } from '@/components/caregiver/notice'
import { VisitChecklist, type ChecklistRow } from '@/components/caregiver/visit-checklist'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime, formatTime } from '@/lib/datetime'
import { DAY_PASSED, GO_TO_VISIT_IN_PROGRESS, anotherVisitInProgress, beforeTheDay, checkedInLine } from '@/lib/visits/assignment-text'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface AssignmentDetail {
  id: string
  requested_datetime: string
  bundle_code: BundleCode
  status: string
  care_recipients: { name: string; care_notes: string | null } | null
}

// One row of caregiver_visit (migration 0013): which state the screen is in, decided by the
// server's clock and the visit itself, never by the device.
interface VisitState {
  day_state: 'before' | 'today' | 'passed'
  checked_in_at: string | null
  other_booking_id: string | null
  other_recipient_name: string | null
  other_bundle_code: BundleCode | null
}

// FR-010 / AC-010, frames VER-12 and VER-12b, extended by DEV-064 (FD-VISIT frames VIS-02 to
// VIS-05b). The booking summary is the top block; directly under it the notice for the state
// (before the day, another visit open, the day has passed), then the read-only checklist, then
// the care notes. On the day, with nothing else open, the Check in button is in a bar fixed at
// the bottom. FD-VISIT's later screens extend this page below (tasks, check-out).
//
// The database lets a Caregiver read a booking, and its recipient's care notes,
// only while it is assigned to them and they are currently Verified (migration
// 0009). So when the booking was reassigned, or the Caregiver stopped being
// Verified, this page simply gets no row, and shows one message for both causes
// (BR-007, §5.7(p), AC-021): no reason, none of the words "Verified", "removed" or
// "reassigned" (§6.5, §6.6(n)), and nothing from the booking or its notes. A
// booking that never existed, or that belongs to someone else, reads the same, so
// the page tells a Caregiver nothing about bookings that are not theirs. The page
// is rendered on every load, so the message appears the next time it loads or
// refreshes.
export default async function AssignmentDetailPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('bookings')
    .select('id, requested_datetime, bundle_code, status, care_recipients(name, care_notes)')
    .eq('id', params.id)
    .eq('assigned_caregiver_id', user!.id)
    .maybeSingle()
  if (error) throw new Error(`Failed to load assignment: ${error.message}`)
  const booking = data as unknown as AssignmentDetail | null

  if (!booking) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-6 py-10 text-figma-ink">
        <h1 className="text-[28px] font-bold leading-9">This booking is no longer available to you.</h1>
        <p className="text-[16px] leading-[1.4]">
          Its details and care notes are no longer shown. If you weren&apos;t expecting this, contact Vizazi Care at <ContactEmailLink />.
        </p>
        <ActionLink href="/assignments" variant="secondary" className="self-start">
          Back to my assignments
        </ActionLink>
      </main>
    )
  }

  const careNotes = booking.care_recipients?.care_notes?.trim() || null

  const { data: stateRow, error: stateError } = await supabase
    .from('caregiver_visit')
    .select('day_state, checked_in_at, other_booking_id, other_recipient_name, other_bundle_code')
    .eq('booking_id', booking.id)
    .maybeSingle()
  if (stateError) throw new Error(`Failed to load the visit: ${stateError.message}`)
  const visit = stateRow as VisitState | null

  const { data: items, error: itemsError } = await supabase
    .from('checklist_items')
    .select('id, name, required')
    .eq('bundle_code', booking.bundle_code)
    .order('sort_order', { ascending: true })
  if (itemsError) throw new Error(`Failed to load the checklist: ${itemsError.message}`)

  const assigned = booking.status === 'assigned'
  // Check-in is offered only to a booking still assigned, with no visit, on the day, and
  // with no other visit open (VIS-03, VIS-03b).
  const canCheckIn = assigned && visit?.day_state === 'today' && !visit.other_booking_id

  return (
    <div className="min-h-screen text-figma-ink">
      <AppBar title="Assignment" backHref="/assignments" backLabel="Back to my assignments" />
      <main className={`mx-auto flex max-w-2xl flex-col gap-6 px-6 py-6 ${canCheckIn ? 'pb-28' : ''}`}>
        <h1 className="text-[28px] font-bold leading-9">{booking.care_recipients?.name}</h1>

        <section aria-label="Booking" className="flex flex-col gap-4 rounded-xl border border-figma-line bg-white p-5">
          <div>
            <p className="text-[14px] font-medium text-figma-muted">Care recipient</p>
            <p className="text-[16px]">{booking.care_recipients?.name}</p>
          </div>
          <div>
            <p className="text-[14px] font-medium text-figma-muted">Bundle</p>
            <p className="text-[16px]">{BUNDLE_LINES[booking.bundle_code]}</p>
          </div>
          <div>
            <p className="text-[14px] font-medium text-figma-muted">Date and time</p>
            <p className="text-[16px]">{formatDateTime(booking.requested_datetime)}</p>
          </div>
        </section>

        {visit?.checked_in_at && !assigned && (
          <p className="text-[16px] font-medium" data-testid="checked-in-line">
            {checkedInLine(formatTime(visit.checked_in_at))}
          </p>
        )}

        {assigned && visit?.day_state === 'before' && (
          <Notice>
            <p>{beforeTheDay(booking.requested_datetime)}</p>
          </Notice>
        )}
        {assigned && visit?.day_state === 'today' && visit.other_booking_id && visit.other_recipient_name && visit.other_bundle_code && (
          <Notice>
            <p>{anotherVisitInProgress(visit.other_recipient_name, visit.other_bundle_code)}</p>
            <Link
              href={`/assignments/${visit.other_booking_id}`}
              className="flex min-h-11 items-center self-start text-figma-softtext underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary"
            >
              {GO_TO_VISIT_IN_PROGRESS}
            </Link>
          </Notice>
        )}
        {assigned && visit?.day_state === 'passed' && (
          <Notice>
            <p>{DAY_PASSED}</p>
            <ContactAddressRow />
          </Notice>
        )}

        <VisitChecklist items={(items ?? []) as ChecklistRow[]} />

        <section aria-labelledby="care-notes-heading" className="flex flex-col gap-2 rounded-xl border border-figma-line bg-white p-5">
          <h2 id="care-notes-heading" className="text-[18px] font-semibold leading-[1.3]">
            Care notes
          </h2>
          {careNotes ? (
            <p className="whitespace-pre-wrap text-[16px] leading-[1.4]">{careNotes}</p>
          ) : (
            <p className="text-[16px] leading-[1.4] text-figma-muted">No care notes given.</p>
          )}
        </section>

        {/* DEV-065 on: the tasks, logging them, and check-out */}
      </main>

      {canCheckIn && (
        <CheckInBar bookingId={booking.id} recipientName={booking.care_recipients?.name ?? ''} bundleLine={BUNDLE_LINES[booking.bundle_code]} />
      )}
    </div>
  )
}
