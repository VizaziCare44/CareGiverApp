import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ActionButton } from '@/components/ui/action-button'
import { StatusChip } from '@/components/ui/status-chip'
import { BUNDLES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'

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
// The Assign / Change caregiver button is in place but disabled until Choose
// Caregiver (DEV-042) and its dialogs (DEV-043) exist. Care notes and the name of
// whoever assigned are not in admin_booking_overview, so they are read here.
export default async function AdminBookingDetailPage({ params }: { params: { id: string } }) {
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

  const started = booking.status === 'in_progress' || booking.status === 'completed'
  const needsNewCaregiver = !started && booking.status === 'assigned' && booking.caregiver_verified === false

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-6 text-figma-ink">
      <div>
        <Link href="/admin/queue" className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-[16px] font-medium">
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Booking queue
        </Link>
        <h1 className="mt-2 text-[28px] font-bold leading-9">
          {BUNDLES[booking.bundle_code].name} for {booking.care_recipient_name}
        </h1>
        <p className="mt-2 inline-block rounded-full bg-sand-100 px-3 py-1 text-[14px] font-medium text-sand-800">
          {STATUS_LABEL[booking.status]}
        </p>
      </div>

      <section aria-labelledby="booking-heading" className="flex flex-col gap-4">
        <h2 id="booking-heading" className="text-[18px] font-semibold">
          Booking
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-figma-line bg-white p-5 sm:grid-cols-[10rem_1fr]">
          <Row label="Recipient">{booking.care_recipient_name}</Row>
          <Row label="Care notes">
            {careNotes ? <span className="whitespace-pre-wrap">{careNotes}</span> : <span className="text-figma-muted">No care notes given.</span>}
          </Row>
          <Row label="Bundle">{BUNDLES[booking.bundle_code].name}</Row>
          <Row label="Visit">{formatDateTime(booking.requested_datetime)}</Row>
          <Row label="Status">{STATUS_LABEL[booking.status]}</Row>
          <Row label="Requested at">{formatDateTime(booking.created_at)}</Row>
          <Row label="Requested by">
            {booking.family_name} · {booking.family_phone ?? '—'}
          </Row>
        </dl>
      </section>

      {booking.caregiver_id && (
        <section aria-labelledby="caregiver-heading" className="flex flex-col gap-4">
          <h2 id="caregiver-heading" className="text-[18px] font-semibold">
            Caregiver
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-figma-line bg-white p-5 sm:grid-cols-[10rem_1fr]">
            <Row label="Caregiver">
              <span className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">{booking.caregiver_name}</span>
                <StatusChip status={booking.caregiver_verified ? 'verified' : 'not-verified'} />
              </span>
            </Row>
            <Row label="Assigned by">{assignedBy ?? '—'}</Row>
            <Row label="Assigned at">{booking.assigned_at ? formatDateTime(booking.assigned_at) : '—'}</Row>
          </dl>
          {needsNewCaregiver && (
            <p className="flex items-start gap-1.5 text-[16px] font-medium leading-[1.4] text-figma-danger">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 shrink-0">
                <circle cx="9" cy="9" r="7.5" />
                <path d="M9 5.2v4.6M9 12.4v.1" />
              </svg>
              Caregiver no longer Verified — reassign
            </p>
          )}
        </section>
      )}

      {/* one action at a time, by status; none once the visit has started */}
      {booking.status === 'requested' && (
        <ActionButton variant="primary" disabled className="self-start">
          Assign caregiver
        </ActionButton>
      )}
      {booking.status === 'assigned' && (
        <ActionButton variant="secondary" disabled className="self-start">
          Change caregiver
        </ActionButton>
      )}
      {started && <p className="text-[16px] text-figma-muted">Visit started — caregiver can&apos;t be changed here.</p>}
    </main>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[14px] font-medium text-figma-muted">{label}</dt>
      <dd className="text-[16px] leading-[1.4]">{children}</dd>
    </>
  )
}
