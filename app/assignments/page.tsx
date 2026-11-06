import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MissingBookingHelp } from '@/components/caregiver/missing-booking-help'
import { StatusChip } from '@/components/ui/status-chip'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'
import { groupOf, orderAssignments, type DayState } from '@/lib/assignments/order'
import { IN_PROGRESS_LABEL } from '@/lib/visits/assignment-text'

interface Booking {
  id: string
  status: 'assigned' | 'in_progress'
  requested_datetime: string
  bundle_code: BundleCode
  care_recipients: { name: string } | null
}

// FR-010, FR-011 / AC-010, AC-015, frames VER-11, VER-11b and VIS-01. The Caregiver's own bookings that are
// assigned or in progress (DEV-063 extends DEV-047, it does not rebuild it): the visit in progress first, in a
// bordered card with "In progress" as text plus a clock icon; the rest soonest first; a booking still assigned
// after its day has passed last, with "Visit day has passed" as text plus a dash icon (no "late", "overdue" or
// "missed"). Completed visits are not listed (FR-016). Each card shows the date and time (Africa/Nairobi), the
// recipient's name and the bundle line, and has a chevron on the date line, top right, because EVERY card
// opens Assignment Detail: the whole card is the link, so one target per card. The state of Assignment Detail
// is chosen there from caregiver_visit, not here. A status line appears only on the in-progress card and the
// passed-day card.
//
// The database lets a Caregiver read a booking only while it is assigned to them and they are currently
// Verified (migration 0009), so a booking that was reassigned, or whose caregiver lost Verified, is simply not
// returned. Whether a day has passed is the database's (caregiver_visit.day_state), never the device's. Under
// the list, and under the empty message, the line about contacting Vizazi Care (DEV-047's, in the own-row
// layout). A Caregiver lands here after Log In.
export default async function MyAssignmentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('bookings')
    .select('id, status, requested_datetime, bundle_code, care_recipients(name)')
    .eq('assigned_caregiver_id', user!.id)
    .in('status', ['assigned', 'in_progress'])
  if (error) throw new Error(`Failed to load assignments: ${error.message}`)

  const { data: states, error: statesError } = await supabase.from('caregiver_visit').select('booking_id, day_state')
  if (statesError) throw new Error(`Failed to load the visit states: ${statesError.message}`)
  const dayStateOf = new Map(((states ?? []) as { booking_id: string; day_state: DayState }[]).map((row) => [row.booking_id, row.day_state]))

  const assignments = orderAssignments(((data ?? []) as unknown as Booking[]).map((booking) => ({ ...booking, day_state: dayStateOf.get(booking.id) ?? null })))

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10 text-figma-ink">
      <h1 className="text-[28px] font-bold leading-9">My assignments</h1>

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-figma-line bg-white p-5">
          <p className="text-[18px] leading-[1.4]">No bookings assigned to you yet. When Vizazi Care assigns you a visit, it will appear here.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {assignments.map((assignment) => {
            const group = groupOf(assignment)
            return (
              <li key={assignment.id}>
                <Link
                  href={`/assignments/${assignment.id}`}
                  data-group={group}
                  className={[
                    'flex min-h-11 flex-col gap-1 rounded-xl bg-white p-5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2',
                    group === 'in-progress' ? 'border-2 border-figma-primary' : 'border border-figma-line',
                  ].join(' ')}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[18px] font-semibold leading-[1.3]">{formatDateTime(assignment.requested_datetime)}</span>
                    <svg
                      aria-hidden="true"
                      data-testid="card-chevron"
                      className="mt-0.5 shrink-0"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  <span className="text-[16px] leading-[1.4]">{assignment.care_recipients?.name}</span>
                  <span className="text-[16px] leading-[1.4] text-figma-muted">{BUNDLE_LINES[assignment.bundle_code]}</span>
                  {group === 'in-progress' && (
                    <span className="mt-2 flex">
                      <StatusChip status="in-progress" label={IN_PROGRESS_LABEL} />
                    </span>
                  )}
                  {group === 'passed' && (
                    <span className="mt-2 flex">
                      <StatusChip status="day-passed" />
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <MissingBookingHelp />
    </main>
  )
}
