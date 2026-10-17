import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppBar } from '@/components/ui/app-bar'
import { ActionLink } from '@/components/ui/action-button'
import { ContactEmailLink } from '@/components/caregiver/missing-booking-help'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface AssignmentDetail {
  id: string
  requested_datetime: string
  bundle_code: BundleCode
  care_recipients: { name: string; care_notes: string | null } | null
}

// FR-010 / AC-010, frames VER-12 and VER-12b. Read-only: the recipient's name, the
// bundle, the date and time and the care notes, as a vertical stack that FD-VISIT
// extends below (checklist, check-in and out, tasks) without rebuilding it.
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
    .select('id, requested_datetime, bundle_code, care_recipients(name, care_notes)')
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

  return (
    <div className="min-h-screen text-figma-ink">
      <AppBar title="Assignment" backHref="/assignments" backLabel="Back to my assignments" />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-6">
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

        {/* FD-VISIT adds the checklist, check-in and check-out and the tasks below this line */}
      </main>
    </div>
  )
}
