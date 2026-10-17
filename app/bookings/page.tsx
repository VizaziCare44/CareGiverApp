import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ActionLink } from '@/components/ui/action-button'
import { BookingStatus } from '@/components/booking/booking-status'
import { BUNDLES } from '@/lib/bookings/bundles'
import type { FamilyBookingStatus } from '@/lib/bookings/status-label'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'

interface MyBooking {
  id: string
  care_recipient_name: string
  bundle_code: BundleCode
  requested_datetime: string
  status: FamilyBookingStatus
  caregiver_verified: boolean | null
}

// FR-017 / AC-019, frames VER-09 and 09b. The family's own bookings, soonest
// first, from family_bookings (which already limits the rows to the signed-in
// family and never carries the caregiver's contact details). Each card shows the
// recipient, the bundle, the date and time (Africa/Nairobi) and a status label
// whose icon and words say the same thing. The caregiver is not named here; that
// is Booking Detail (DEV-045). No bookings yet: a message and "Book care", which
// starts at the Care Recipient List where the family picks who the care is for.
export default async function MyBookingsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('family_bookings')
    .select('id, care_recipient_name, bundle_code, requested_datetime, status, caregiver_verified')
    .order('requested_datetime', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw new Error(`Failed to load bookings: ${error.message}`)

  const bookings = (data ?? []) as MyBooking[]

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10 text-figma-ink">
      <h1 className="text-[28px] font-bold leading-9">My bookings</h1>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-figma-line bg-white p-5">
          <p className="text-[18px]">You haven&apos;t requested a booking yet.</p>
          <ActionLink href="/recipients">Book care</ActionLink>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {bookings.map((booking) => (
            <li key={booking.id} className="flex flex-col gap-2 rounded-xl border border-figma-line bg-white p-5">
              <p className="text-[18px] font-semibold leading-[1.3]">{booking.care_recipient_name}</p>
              <p className="text-[16px]">{BUNDLES[booking.bundle_code].name}</p>
              <p className="text-[16px] text-figma-muted">{formatDateTime(booking.requested_datetime)}</p>
              <BookingStatus status={booking.status} caregiverVerified={booking.caregiver_verified} />
              {/* a link of its own, like the Admin queue's: a stray tap on the card does nothing */}
              <Link href={`/bookings/${booking.id}`} className="inline-flex h-12 items-center self-start text-[16px] font-semibold text-figma-softtext underline">
                View details
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
