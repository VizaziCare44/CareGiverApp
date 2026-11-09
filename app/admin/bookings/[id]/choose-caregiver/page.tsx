import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChooseCaregiverForm, type CaregiverChoice } from '@/components/admin/choose-caregiver-form'
import { AdminMain } from '@/components/admin/admin-main'
import { BUNDLES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Booking {
  id: string
  status: 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  bundle_code: BundleCode
  requested_datetime: string
  care_recipient_name: string
  caregiver_id: string | null
  caregiver_name: string | null
}

// FR-005, FR-007, FR-008 / AC-003, AC-006, frames VER-07, 07b, 07c. Admin only.
// Only Verified caregivers are listed, each with their other bookings (information
// only: nothing is marked or blocked). The caregiver who already has this booking
// is shown as "Currently assigned" and cannot be chosen. A line says how many
// caregivers are not shown and why. Reached from Assign / Change caregiver on
// Booking Detail, the queue and the Caregiver Detail panel; Continue opens the
// confirmation dialog that assigns the chosen caregiver (DEV-043).
export default async function ChooseCaregiverPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound()

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('admin_booking_overview')
    .select('id, status, bundle_code, requested_datetime, care_recipient_name, caregiver_id, caregiver_name')
    .eq('id', params.id)
    .maybeSingle()
  if (error) throw new Error(`Failed to load booking: ${error.message}`)
  const booking = data as Booking | null
  if (!booking) notFound()

  const canChoose = booking.status === 'requested' || booking.status === 'assigned'

  let caregivers: CaregiverChoice[] = []
  let notShown = 0

  if (canChoose) {
    const { data: all, error: caregiversError } = await supabase
      .from('caregiver_overview')
      .select('id, full_name, verified')
      .order('full_name', { ascending: true })
    if (caregiversError) throw new Error(`Failed to load caregivers: ${caregiversError.message}`)

    const verified = (all ?? []).filter((c) => c.verified) as { id: string; full_name: string }[]
    notShown = (all ?? []).length - verified.length

    const others: { caregiver_id: string; requested_datetime: string }[] = []
    if (verified.length > 0) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('admin_booking_overview')
        .select('caregiver_id, requested_datetime')
        .not('caregiver_id', 'is', null)
        .in('status', ['assigned', 'in_progress'])
        .neq('id', booking.id)
        .order('requested_datetime', { ascending: true })
      if (bookingsError) throw new Error(`Failed to load caregivers' bookings: ${bookingsError.message}`)
      // filtered here, not with .in(): a long list of caregiver ids makes the request address too long
      const verifiedIds = new Set(verified.map((c) => c.id))
      others.push(...((bookings ?? []) as typeof others).filter((o) => verifiedIds.has(o.caregiver_id)))
    }

    caregivers = verified.map((c) => ({
      id: c.id,
      name: c.full_name,
      current: c.id === booking.caregiver_id,
      otherBookings: others.filter((o) => o.caregiver_id === c.id).map((o) => formatDateTime(o.requested_datetime)),
    }))
  }

  const summary = `${booking.care_recipient_name} · ${BUNDLES[booking.bundle_code].name} · ${formatDateTime(booking.requested_datetime)}`
  const mode = booking.status === 'assigned' ? 'change' : 'assign'

  return (
    <AdminMain>
      <Link href={`/admin/bookings/${booking.id}`} className="inline-flex h-11 items-center gap-1 self-start text-[16px] font-semibold leading-[1.4] text-figma-primary underline">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 4.5l-5.5 5.5 5.5 5.5" />
        </svg>
        Booking details
      </Link>

      <h1 className="text-[28px] font-bold leading-[1.25]">{mode === 'change' ? 'Change caregiver' : 'Choose a caregiver'}</h1>
      <p className="text-[16px] font-semibold leading-[1.4]">{summary}</p>

      {!canChoose ? (
        <p className="rounded-[12px] border border-figma-border bg-white p-5 text-[16px] font-semibold leading-[1.4]">
          {booking.status === 'cancelled'
            ? "This booking is cancelled, so a caregiver can't be chosen."
            : "Visit started — caregiver can't be changed here."}
        </p>
      ) : (
        <>
          {caregivers.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-[12px] border border-figma-border bg-white p-6">
              <p className="text-[16px] font-semibold leading-[1.4]">No caregiver is Verified yet. Verify a caregiver first, then come back to assign this booking.</p>
              <Link href="/admin/caregivers" className="inline-flex h-11 items-center text-[16px] font-semibold leading-[1.4] text-figma-primary underline">
                Go to Caregivers
              </Link>
            </div>
          ) : (
            <ChooseCaregiverForm
              bookingId={booking.id}
              mode={mode}
              recipient={booking.care_recipient_name}
              summary={summary}
              previousCaregiver={booking.caregiver_name}
              caregivers={caregivers}
              notShown={notShown}
            />
          )}
        </>
      )}
    </AdminMain>
  )
}
