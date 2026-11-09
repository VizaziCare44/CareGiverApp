import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ActionLink } from '@/components/ui/action-button'
import { AppBar } from '@/components/ui/app-bar'
import { BookingStatus } from '@/components/booking/booking-status'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import { orderBookings } from '@/lib/bookings/order'
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

// FR-017 / AC-019, frames VER-09 and 09b; ordered by orderBookings (DEV-078: in progress first, then the
// bookings still to come soonest first, then completed newest first). The family's own bookings
// from family_bookings (which already limits the rows to the signed-in
// family and never carries the caregiver's contact details). Each card shows the
// recipient, the bundle, the date and time (Africa/Nairobi) and a status label
// whose icon and words say the same thing; the whole card is the link to Booking Detail (the chevron says so).
// The caregiver is not named here; that is Booking Detail (DEV-045). No bookings yet: a sentence and
// "Book care" at the bottom, which starts at the Care Recipient List where the family picks who the care is for.
export default async function MyBookingsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('family_bookings')
    .select('id, care_recipient_name, bundle_code, requested_datetime, status, caregiver_verified')
  if (error) throw new Error(`Failed to load bookings: ${error.message}`)

  const bookings = orderBookings((data ?? []) as MyBooking[])

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white text-figma-ink">
      <AppBar title="My bookings" backHref="/recipients" backLabel="Back to Care recipients" />
      <main className="flex flex-1 flex-col gap-4 p-5">
        <h1 className="sr-only">My bookings</h1>

        {bookings.length === 0 ? (
          <>
            <p className="text-[18px] font-semibold leading-[1.4]">You haven&apos;t requested a booking yet.</p>
            <div className="flex-1" />
            <ActionLink href="/recipients" className="w-full">
              Book care
            </ActionLink>
          </>
        ) : (
          <ul className="flex flex-col gap-4">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <Link
                  href={`/bookings/${booking.id}`}
                  className="flex flex-col gap-2 rounded-[14px] border border-figma-border bg-white p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2"
                >
                  <span className="flex items-center">
                    <span className="min-w-0 flex-1 text-[18px] font-bold leading-[1.4]">{booking.care_recipient_name}</span>
                    <svg aria-hidden="true" className="shrink-0" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  <span className="text-[15px] leading-[1.4]">{BUNDLE_LINES[booking.bundle_code]}</span>
                  <span className="text-[15px] leading-[1.4] text-figma-muted">{formatDateTime(booking.requested_datetime)}</span>
                  <BookingStatus status={booking.status} caregiverVerified={booking.caregiver_verified} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
