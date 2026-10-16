import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChooseCaregiverForm, type CaregiverChoice } from '@/components/admin/choose-caregiver-form'
import { ActionLink } from '@/components/ui/action-button'
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
}

// FR-005, FR-007, FR-008 / AC-003, AC-006, frames VER-07, 07b, 07c. Admin only.
// Only Verified caregivers are listed, each with their other bookings (information
// only: nothing is marked or blocked). The caregiver who already has this booking
// is shown as "Currently assigned" and cannot be chosen. A line says how many
// caregivers are not shown and why. Reached from Assign / Change caregiver on
// Booking Detail, the queue and the Caregiver Detail panel; assigning the chosen
// caregiver is DEV-043.
export default async function ChooseCaregiverPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound()

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('admin_booking_overview')
    .select('id, status, bundle_code, requested_datetime, care_recipient_name, caregiver_id')
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
        .in('caregiver_id', verified.map((c) => c.id))
        .in('status', ['assigned', 'in_progress'])
        .neq('id', booking.id)
        .order('requested_datetime', { ascending: true })
      if (bookingsError) throw new Error(`Failed to load caregivers' bookings: ${bookingsError.message}`)
      others.push(...((bookings ?? []) as typeof others))
    }

    caregivers = verified.map((c) => ({
      id: c.id,
      name: c.full_name,
      current: c.id === booking.caregiver_id,
      otherBookings: others.filter((o) => o.caregiver_id === c.id).map((o) => formatDateTime(o.requested_datetime)),
    }))
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-6 text-figma-ink">
      <div>
        <Link href={`/admin/bookings/${booking.id}`} className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-[16px] font-medium">
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Booking
        </Link>
        <h1 className="mt-2 text-[28px] font-bold leading-9">Choose a caregiver</h1>
        <p className="mt-1 text-[16px] text-figma-muted">
          {BUNDLES[booking.bundle_code].name} for {booking.care_recipient_name} · {formatDateTime(booking.requested_datetime)}
        </p>
      </div>

      {!canChoose ? (
        <p className="rounded-xl border border-figma-line bg-white p-5 text-[16px]">
          {booking.status === 'cancelled'
            ? "This booking is cancelled, so a caregiver can't be chosen."
            : "Visit started — caregiver can't be changed here."}
        </p>
      ) : (
        <>
          {caregivers.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-xl border border-figma-line bg-white p-5">
              <p className="text-[16px]">No Verified caregivers yet. A caregiver has to be marked as Verified before they can be assigned.</p>
              <ActionLink href="/admin/caregivers" variant="secondary">
                Go to Caregivers
              </ActionLink>
            </div>
          ) : (
            <ChooseCaregiverForm caregivers={caregivers} />
          )}

          {notShown > 0 && (
            <p className="text-[16px] text-figma-muted">
              {notShown === 1 ? '1 caregiver is' : `${notShown} caregivers are`} not shown because they are not Verified.
            </p>
          )}
        </>
      )}
    </main>
  )
}
