import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusChip } from '@/components/ui/status-chip'
import { ActionButton } from '@/components/ui/action-button'
import { CaregiverActions } from '@/components/admin/caregiver-actions'
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
  requested_datetime: string
  care_recipient_name: string
}

const actionText = {
  verified: 'Marked as Verified',
  removed: 'Removed Verified status',
} as const

// FR-004, FR-016 / AC-009, AC-018, frames VER-02, 02b, 02c. Admin only
// (middleware guards /admin; the views and policies are Admin-only as well).
// Mark as Verified opens its dialog (DEV-038). Remove Verified and Reassign are
// in place but disabled until DEV-039 and DEV-042/043.
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
      .select('id, requested_datetime, care_recipient_name')
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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-6 text-figma-ink">
      <div>
        <Link
          href="/admin/caregivers"
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-[16px] font-medium"
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Caregivers
        </Link>
        <h1 className="mt-2 text-[28px] font-bold leading-9">{caregiver.full_name}</h1>
      </div>

      <section aria-labelledby="status-heading" className="flex flex-col gap-4">
        <h2 id="status-heading" className="text-[18px] font-semibold">
          Status
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status={caregiver.verified ? 'verified' : 'not-verified'} />
          {caregiver.last_changed_at && (
            <p className="text-[16px] text-figma-muted">
              Last changed by {caregiver.last_changed_by_name ?? 'an Admin'} on {formatDateTime(caregiver.last_changed_at)}
            </p>
          )}
        </div>
        {/* one action at a time, by current status */}
        <CaregiverActions caregiverId={caregiver.id} name={caregiver.full_name} verified={caregiver.verified} />
      </section>

      <section aria-labelledby="affected-heading" className="flex flex-col gap-3">
        <h2 id="affected-heading" className="text-[18px] font-semibold">
          Bookings that need a new caregiver
        </h2>
        {affected.length === 0 ? (
          <p className="rounded-xl border border-figma-line bg-white p-5 text-[16px]">No upcoming bookings are affected.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {affected.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-figma-line bg-white px-5 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-[16px] font-semibold">{formatDateTime(booking.requested_datetime)}</span>
                  <span className="text-[16px] text-figma-muted">For {booking.care_recipient_name}</span>
                </div>
                <ActionButton variant="secondary" disabled>
                  Reassign
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-[18px] font-semibold">
          Verification history
        </h2>
        {history.length === 0 ? (
          <p className="rounded-xl border border-figma-line bg-white p-5 text-[16px]">No verification changes yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 rounded-xl border border-figma-line bg-white px-5 py-3">
                <span className="text-[16px] font-semibold">{actionText[entry.action]}</span>
                <span className="text-[16px] text-figma-muted">
                  By {entry.actor?.full_name ?? 'an Admin'}, {formatDateTime(entry.created_at)}
                </span>
                <p className="mt-1 whitespace-pre-wrap text-[16px]">{entry.note}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
