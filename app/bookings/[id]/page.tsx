import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppBar } from '@/components/ui/app-bar'
import { BookingStatus } from '@/components/booking/booking-status'
import { CaregiverBlock } from '@/components/booking/caregiver-block'
import { BUNDLES } from '@/lib/bookings/bundles'
import { caregiverBlockState } from '@/lib/bookings/caregiver-block'
import type { FamilyBookingStatus } from '@/lib/bookings/status-label'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface FamilyBooking {
  id: string
  care_recipient_name: string
  bundle_code: BundleCode
  requested_datetime: string
  status: FamilyBookingStatus
  caregiver_name: string | null
  caregiver_verified: boolean | null
}

// FR-011, FR-012, FR-017 / AC-011, AC-012, frames VER-10 to VER-10d. The family's
// own booking: the summary at the top, the caregiver block under it in one of the
// four states of FD-VERIFY §6.1 Flow E (see lib/bookings/caregiver-block.ts), picked
// from the live status on every load. Everything comes from family_bookings, which
// limits the rows to the signed-in family and returns the caregiver's name only
// when the rules allow it, with nothing else about the caregiver. The stack ends
// here on purpose: what FD-FAMVIS adds (visit progress, the report) goes below.
export default async function FamilyBookingDetailPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('family_bookings')
    .select('id, care_recipient_name, bundle_code, requested_datetime, status, caregiver_name, caregiver_verified')
    .eq('id', params.id)
    .maybeSingle()
  if (error) throw new Error(`Failed to load booking: ${error.message}`)
  const booking = data as FamilyBooking | null
  if (!booking) notFound()

  const state = caregiverBlockState(booking.status, booking.caregiver_name, booking.caregiver_verified)
  const bundle = BUNDLES[booking.bundle_code]

  return (
    <div className="min-h-screen text-figma-ink">
      <AppBar title="Booking" backHref="/bookings" backLabel="Back to My bookings" />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-6">
        <h1 className="text-[28px] font-bold leading-9">
          {bundle.name} for {booking.care_recipient_name}
        </h1>

        <section aria-label="Booking" className="flex flex-col gap-4 rounded-xl border border-figma-line bg-white p-5">
          <div>
            <p className="text-[14px] font-medium text-figma-muted">Care recipient</p>
            <p className="text-[16px]">{booking.care_recipient_name}</p>
          </div>
          <div>
            <p className="text-[14px] font-medium text-figma-muted">Bundle</p>
            <p className="text-[16px]">{bundle.name}</p>
          </div>
          <div>
            <p className="text-[14px] font-medium text-figma-muted">Date and time</p>
            <p className="text-[16px]">{formatDateTime(booking.requested_datetime)}</p>
          </div>
          <div>
            <p className="mb-1 text-[14px] font-medium text-figma-muted">Status</p>
            <BookingStatus status={booking.status} caregiverVerified={booking.caregiver_verified} />
          </div>
        </section>

        {state && <CaregiverBlock state={state} name={state === 'verified' || state === 'started-unverified' ? booking.caregiver_name : null} />}
      </main>
    </div>
  )
}
