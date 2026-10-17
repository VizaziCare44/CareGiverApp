import { createClient } from '@/lib/supabase/server'
import { MissingBookingHelp } from '@/components/caregiver/missing-booking-help'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'

interface Assignment {
  id: string
  requested_datetime: string
  bundle_code: BundleCode
  care_recipients: { name: string } | null
}

// FR-010 / AC-010, frames VER-11 and VER-11b. The Caregiver's own assigned
// bookings, soonest first, each with the date and time (Africa/Nairobi), the
// recipient's name and the bundle line. Nothing about unassigned bookings or
// other caregivers' bookings: the database lets a caregiver read a booking only
// while it is assigned to them and they are currently Verified (migration 0009),
// so a booking that was reassigned, or whose caregiver lost Verified, is simply
// not returned. Under the list, and under the empty message, the line about
// contacting Vizazi Care. A Caregiver lands here after Log In. The rows have no
// link yet: Assignment Detail is DEV-048.
export default async function MyAssignmentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('bookings')
    .select('id, requested_datetime, bundle_code, care_recipients(name)')
    .eq('assigned_caregiver_id', user!.id)
    .eq('status', 'assigned')
    .order('requested_datetime', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw new Error(`Failed to load assignments: ${error.message}`)

  const assignments = (data ?? []) as unknown as Assignment[]

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10 text-figma-ink">
      <h1 className="text-[28px] font-bold leading-9">My assignments</h1>

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-figma-line bg-white p-5">
          <p className="text-[18px] leading-[1.4]">No bookings assigned to you yet. When Vizazi Care assigns you a visit, it will appear here.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="flex flex-col gap-1 rounded-xl border border-figma-line bg-white p-5">
              <p className="text-[18px] font-semibold leading-[1.3]">{formatDateTime(assignment.requested_datetime)}</p>
              <p className="text-[16px] leading-[1.4]">{assignment.care_recipients?.name}</p>
              <p className="text-[16px] leading-[1.4] text-figma-muted">{BUNDLE_LINES[assignment.bundle_code]}</p>
            </li>
          ))}
        </ul>
      )}

      <MissingBookingHelp />
    </main>
  )
}
