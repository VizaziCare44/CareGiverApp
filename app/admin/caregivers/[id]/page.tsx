import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusChip } from '@/components/ui/status-chip'
import { ActionLink } from '@/components/ui/action-button'
import { CaregiverActions } from '@/components/admin/caregiver-actions'
import { AdminMain } from '@/components/admin/admin-main'
import { BUNDLES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Caregiver {
  id: string
  full_name: string
  verified: boolean
  last_changed_at: string | null
  last_changed_by_name: string | null
}

interface HistoryEntry {
  id: string
  action: 'verified' | 'removed'
  note: string
  created_at: string
  actor: { full_name: string } | null
}

interface AffectedBooking {
  id: string
  bundle_code: BundleCode
  requested_datetime: string
  care_recipient_name: string
}

const actionText = {
  verified: 'Marked Verified',
  removed: 'Verified removed',
} as const

// FR-004, FR-016 / AC-009, AC-018, frames VER-02, 02b, 02c. Admin only
// (middleware guards /admin; the views and policies are Admin-only as well).
// Mark as Verified (DEV-038) and Remove Verified (DEV-039) open their dialogs.
// Reassign opens Choose Caregiver for that booking (DEV-042).
export default async function CaregiverDetailPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound()

  const supabase = await createClient()

  const [caregiverResult, historyResult, affectedResult] = await Promise.all([
    supabase
      .from('caregiver_overview')
      .select('id, full_name, verified, last_changed_at, last_changed_by_name')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('caregiver_verifications')
      .select('id, action, note, created_at, actor:profiles!caregiver_verifications_acted_by_fkey(full_name)')
      .eq('caregiver_id', params.id)
      .order('created_at', { ascending: false }),
    // bookings still assigned to this caregiver, visit not started, caregiver
    // not currently Verified: they need a new caregiver
    supabase
      .from('admin_booking_overview')
      .select('id, bundle_code, requested_datetime, care_recipient_name')
      .eq('caregiver_id', params.id)
      .eq('status', 'assigned')
      .eq('caregiver_verified', false)
      .order('requested_datetime', { ascending: true }),
  ])

  if (caregiverResult.error) throw new Error(`Failed to load caregiver: ${caregiverResult.error.message}`)
  if (historyResult.error) throw new Error(`Failed to load verification history: ${historyResult.error.message}`)
  if (affectedResult.error) throw new Error(`Failed to load affected bookings: ${affectedResult.error.message}`)

  const caregiver = caregiverResult.data as Caregiver | null
  if (!caregiver) notFound()

  const history = (historyResult.data ?? []) as unknown as HistoryEntry[]
  const affected = (affectedResult.data ?? []) as AffectedBooking[]

  // the sentence under "Current status": who last changed it and when (frames VER-02, 02b, 02c)
  const by = caregiver.last_changed_by_name ?? 'an Admin'
  const currentStatus = caregiver.last_changed_at
    ? caregiver.verified
      ? `Marked Verified by ${by} on ${formatDateTime(caregiver.last_changed_at)}.`
      : `Verified status removed by ${by} on ${formatDateTime(caregiver.last_changed_at)}.`
    : 'Not verified. No one has marked this caregiver Verified yet.'

  return (
    <AdminMain>
      <Link href="/admin/caregivers" className="inline-flex h-11 items-center gap-1 self-start text-[16px] font-semibold leading-[1.4] text-figma-primary underline">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 4.5l-5.5 5.5 5.5 5.5" />
        </svg>
        Caregivers
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-[28px] font-bold leading-[1.25]">{caregiver.full_name}</h1>
        <StatusChip status={caregiver.verified ? 'verified' : 'not-verified'} />
      </div>

      <section aria-labelledby="status-heading" className="flex flex-col items-start gap-3 rounded-[12px] border border-figma-border bg-white p-5">
        <h2 id="status-heading" className="text-[14px] font-semibold leading-[1.4] text-figma-muted">
          Current status
        </h2>
        <p className="text-[16px] leading-[1.4]">{currentStatus}</p>
        {/* one action at a time, by current status */}
        <CaregiverActions caregiverId={caregiver.id} name={caregiver.full_name} verified={caregiver.verified} />
      </section>

      {affected.length > 0 && (
        <section aria-labelledby="affected-heading" className="flex flex-col gap-3 rounded-[12px] border border-figma-ambertext bg-figma-amber p-5">
          <h2 id="affected-heading" className="flex items-center gap-2 text-[18px] font-bold leading-[1.4] text-figma-ambertext">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2.5l8 14H2z" />
              <path d="M10 8v4M10 14.2v.1" />
            </svg>
            Bookings that need a new caregiver
          </h2>
          <ul className="flex flex-col">
            {affected.map((booking, index) => (
              <li
                key={booking.id}
                className={['flex flex-wrap items-center justify-between gap-4 py-2 sm:flex-nowrap', index > 0 ? 'border-t border-figma-line' : ''].join(' ')}
              >
                <p className="min-w-0 flex-1 text-[15px] leading-[1.4]">
                  {booking.care_recipient_name} · {BUNDLES[booking.bundle_code].name} · {formatDateTime(booking.requested_datetime)}
                </p>
                <ActionLink href={`/admin/bookings/${booking.id}/choose-caregiver`} variant="secondary" className="w-[140px] shrink-0">
                  Reassign
                </ActionLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="history-heading" className="flex flex-col gap-1 rounded-[12px] border border-figma-border bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 id="history-heading" className="text-[18px] font-bold leading-[1.4]">
            Verification history
          </h2>
          <span className="text-[14px] leading-[1.4] text-figma-muted">Visible to Admin only</span>
        </div>
        {history.length === 0 ? (
          <p className="text-[16px] leading-[1.4] text-figma-muted">No verification changes yet.</p>
        ) : (
          <ol className="flex flex-col">
            {history.map((entry, index) => (
              <li
                key={entry.id}
                className={['flex flex-col gap-1 py-[14px] md:flex-row md:items-start md:gap-6', index > 0 ? 'border-t border-figma-line' : ''].join(' ')}
              >
                <span className="flex items-center gap-2 text-[15px] font-semibold leading-[1.4] md:w-[200px] md:shrink-0">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {entry.action === 'verified' ? <path d="M3.5 8.5l3 3 6-7" /> : <path d="M3.5 8h9" />}
                  </svg>
                  {actionText[entry.action]}
                </span>
                <span className="flex flex-col gap-0.5 md:w-[220px] md:shrink-0">
                  <span className="text-[15px] leading-[1.4]">{entry.actor?.full_name ?? 'an Admin'}</span>
                  <span className="text-[14px] leading-[1.4] text-figma-muted">{formatDateTime(entry.created_at)}</span>
                </span>
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-[1.4]">
                  {entry.action === 'removed' ? `Reason: ${entry.note}` : entry.note}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </AdminMain>
  )
}
