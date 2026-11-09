import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ActionLink } from '@/components/ui/action-button'
import { StatusChip } from '@/components/ui/status-chip'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import { AdminMain } from '@/components/admin/admin-main'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'
import { bannerText } from '@/lib/admin/assign-dialog-text'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Booking {
  id: string
  status: 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  bundle_code: BundleCode
  requested_datetime: string
  created_at: string
  family_name: string
  family_phone: string | null
  care_recipient_id: string
  care_recipient_name: string
  caregiver_id: string | null
  caregiver_name: string | null
  caregiver_verified: boolean | null
  assigned_by: string | null
  assigned_at: string | null
}

const STATUS_LABEL = {
  requested: 'Requested',
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const

// FR-006, FR-013 / AC-008, AC-014, frames VER-06, 06b, 06c. Admin only
// (middleware guards /admin; the view and policies are Admin-only as well).
// Assign / Change caregiver lead to Choose Caregiver (DEV-042); assigning there is
// DEV-043. Care notes and the name of whoever assigned are not in
// admin_booking_overview, so they are read here.
export default async function AdminBookingDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { banner?: string }
}) {
  if (!UUID.test(params.id)) notFound()

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('admin_booking_overview')
    .select(
      'id, status, bundle_code, requested_datetime, created_at, family_name, family_phone, care_recipient_id, care_recipient_name, caregiver_id, caregiver_name, caregiver_verified, assigned_by, assigned_at',
    )
    .eq('id', params.id)
    .maybeSingle()
  if (error) throw new Error(`Failed to load booking: ${error.message}`)
  const booking = data as Booking | null
  if (!booking) notFound()

  const [notesResult, assignerResult] = await Promise.all([
    supabase.from('care_recipients').select('care_notes').eq('id', booking.care_recipient_id).maybeSingle(),
    booking.assigned_by
      ? supabase.from('profiles').select('full_name').eq('id', booking.assigned_by).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (notesResult.error) throw new Error(`Failed to load care notes: ${notesResult.error.message}`)
  if (assignerResult.error) throw new Error(`Failed to load the assigning Admin: ${assignerResult.error.message}`)

  const careNotes = (notesResult.data as { care_notes: string | null } | null)?.care_notes?.trim() || null
  const assignedBy = (assignerResult.data as { full_name: string } | null)?.full_name ?? null

  const banner = bannerText(searchParams.banner)
  const started = booking.status === 'in_progress' || booking.status === 'completed'
  const needsNewCaregiver = !started && booking.status === 'assigned' && booking.caregiver_verified === false

  return (
    <AdminMain>
      {banner && (
        <p role="status" className="rounded-[12px] border border-figma-primary bg-figma-soft p-4 text-[16px] font-semibold text-figma-softtext">
          {banner}
        </p>
      )}

      <Link href="/admin/queue" className="inline-flex h-11 items-center gap-1 self-start text-[16px] font-semibold leading-[1.4] text-figma-primary underline">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 4.5l-5.5 5.5 5.5 5.5" />
        </svg>
        Booking Queue
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        {/* frames VER-06, 06b, 06c: "Booking · {recipient}" (FD-ADMINEXC R-09, decision 9) */}
        <h1 className="text-[28px] font-bold leading-[1.25]">Booking · {booking.care_recipient_name}</h1>
        {booking.status === 'requested' && <StatusChip status="awaiting" label="Requested" />}
        {booking.status === 'assigned' && <StatusChip status="assigned" label="Assigned" />}
        {/* a visit that has started has no chip in VER-06c: the words alone */}
        {(booking.status === 'in_progress' || booking.status === 'completed' || booking.status === 'cancelled') && (
          <span className="text-[14px] font-medium leading-[1.4]">{STATUS_LABEL[booking.status]}</span>
        )}
      </div>

      <section aria-labelledby="booking-heading" className="rounded-[12px] border border-figma-border bg-white px-5 py-2">
        <h2 id="booking-heading" className="sr-only">
          Booking
        </h2>
        <dl className="flex flex-col">
          <Row label="Care recipient">{booking.care_recipient_name}</Row>
          <Row label="Care notes">{careNotes ? <span className="whitespace-pre-wrap">{careNotes}</span> : <span className="text-figma-muted">No care notes given.</span>}</Row>
          <Row label="Bundle">{BUNDLE_LINES[booking.bundle_code]}</Row>
          <Row label="Date and time of the visit">{formatDateTime(booking.requested_datetime)}</Row>
          <Row label="Requested at">{formatDateTime(booking.created_at)}</Row>
          {/* not drawn in VER-06 to 06c; kept so the Admin can reach the family (DEV-022, DEV-041) */}
          <Row label="Requested by">
            {booking.family_name} · {booking.family_phone ?? '—'}
          </Row>
          {booking.caregiver_id && (
            <>
              <Row label="Caregiver">
                <span className="flex flex-col items-start gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{booking.caregiver_name}</span>
                    <StatusChip status={booking.caregiver_verified ? 'verified' : 'not-verified'} />
                  </span>
                  {needsNewCaregiver && (
                    <span className="flex items-center gap-1.5 text-[14px] font-semibold leading-[1.4] text-figma-ambertext">
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M10 2.5l8 14H2z" />
                        <path d="M10 8v4M10 14.2v.1" />
                      </svg>
                      Caregiver no longer Verified — reassign
                    </span>
                  )}
                </span>
              </Row>
              <Row label="Assigned by">{assignedBy ?? '—'}</Row>
              <Row label="Assigned at">{booking.assigned_at ? formatDateTime(booking.assigned_at) : '—'}</Row>
            </>
          )}
        </dl>
      </section>

      {/* one action at a time, by status; none once the visit has started */}
      {booking.status === 'requested' && (
        <ActionLink href={`/admin/bookings/${booking.id}/choose-caregiver`} variant="primary" className="w-full self-start sm:w-[260px]">
          Assign caregiver
        </ActionLink>
      )}
      {booking.status === 'assigned' && (
        <ActionLink href={`/admin/bookings/${booking.id}/choose-caregiver`} variant="secondary" className="w-full self-start sm:w-[260px]">
          Change caregiver
        </ActionLink>
      )}
      {started && (
        <p className="flex items-center gap-2 text-[16px] leading-[1.4]">
          <svg aria-hidden="true" className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 11v6M12 7.2v.1" />
          </svg>
          Visit started — caregiver can&apos;t be changed here.
        </p>
      )}
    </AdminMain>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-figma-line py-3 first:border-t-0 sm:flex-row sm:gap-6">
      <dt className="text-[14px] leading-[1.4] text-figma-muted sm:w-[220px] sm:shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 text-[16px] font-medium leading-[1.4]">{children}</dd>
    </div>
  )
}
