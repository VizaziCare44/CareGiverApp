import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { ActionButton } from '@/components/ui/action-button'
import { BUNDLES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { formatDateTime } from '@/lib/datetime'

interface QueueRow {
  id: string
  status: 'requested' | 'assigned' | 'in_progress' | 'completed'
  bundle_code: BundleCode
  requested_datetime: string
  created_at: string
  family_name: string
  family_phone: string | null
  care_recipient_name: string
  caregiver_name: string | null
  caregiver_verified: boolean | null
}

const STARTED_LABEL = { in_progress: 'In progress', completed: 'Completed' } as const
const ASSIGNED_ORDER = { assigned: 0, in_progress: 1, completed: 2 } as const

// A link of its own to Booking Detail (DEV-041); the card is not clickable.
function DetailsLink({ id }: { id: string }) {
  return (
    <Link href={`/admin/bookings/${id}`} className="inline-flex h-12 items-center text-[16px] font-semibold text-figma-softtext underline">
      View details
    </Link>
  )
}

// FR-006, FR-009, FR-013 / §7.6, frames VER-05 and VER-05b. DEV-022's Requested
// list, extended (DEV-040) with an Assigned tab, an "Assign caregiver" action and
// a requested-at line. The data comes from admin_booking_overview. The actions
// are separate buttons, never the whole row, so a stray tap on a row does
// nothing. The buttons are in place but disabled until Booking Detail (DEV-041)
// and Choose Caregiver (DEV-042) exist to send the Admin somewhere.
export default async function AdminQueuePage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab === 'assigned' ? 'assigned' : 'requested'

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('admin_booking_overview')
    .select(
      'id, status, bundle_code, requested_datetime, created_at, family_name, family_phone, care_recipient_name, caregiver_name, caregiver_verified',
    )
    .in('status', ['requested', 'assigned', 'in_progress', 'completed'])

  if (error) throw new Error(`Failed to load booking queue: ${error.message}`)

  const all = (data ?? []) as QueueRow[]
  const requested = all
    .filter((row) => row.status === 'requested')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const assigned = all
    .filter((row) => row.status !== 'requested')
    .sort(
      (a, b) =>
        ASSIGNED_ORDER[a.status as keyof typeof ASSIGNED_ORDER] - ASSIGNED_ORDER[b.status as keyof typeof ASSIGNED_ORDER] ||
        a.requested_datetime.localeCompare(b.requested_datetime),
    )

  const tabs = [
    { key: 'requested', label: 'Requested', count: requested.length, href: '/admin/queue' },
    { key: 'assigned', label: 'Assigned', count: assigned.length, href: '/admin/queue?tab=assigned' },
  ] as const

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl text-foreground">Booking queue</h1>

      <nav aria-label="Booking queue views" className="-mt-2 flex gap-1 border-b border-figma-line">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={tab === t.key ? 'page' : undefined}
            className={[
              'inline-flex h-12 items-center border-b-2 px-3 text-[16px] text-figma-ink',
              tab === t.key ? 'border-figma-softtext font-semibold' : 'border-transparent font-medium',
            ].join(' ')}
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </nav>

      {tab === 'requested' ? (
        requested.length === 0 ? (
          <Card>
            <p className="text-lg text-muted-foreground">No new requests.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {requested.map((row) => (
              <li key={row.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-foreground">{BUNDLES[row.bundle_code].name}</span>
                    <span className="rounded-full bg-sand-100 px-3 py-1 text-sm font-medium text-sand-800">Requested</span>
                  </div>
                  <p className="text-base text-foreground">Recipient: {row.care_recipient_name}</p>
                  <p className="text-base text-muted-foreground">
                    Requested by {row.family_name} · {row.family_phone ?? '—'}
                  </p>
                  <p className="text-base text-muted-foreground">Visit: {formatDateTime(row.requested_datetime)}</p>
                  <p className="text-base text-muted-foreground">Requested at: {formatDateTime(row.created_at)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <ActionButton variant="primary" disabled>
                      Assign caregiver
                    </ActionButton>
                    <DetailsLink id={row.id} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : assigned.length === 0 ? (
        <Card>
          <p className="text-lg text-muted-foreground">No assigned bookings yet.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {assigned.map((row) => {
            const started = row.status === 'in_progress' || row.status === 'completed'
            // reassignment is not available once a visit starts (AC-008), so no flag and no entry then
            const needsNewCaregiver = !started && row.caregiver_verified === false
            return (
              <li key={row.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-foreground">{BUNDLES[row.bundle_code].name}</span>
                    <span className="rounded-full bg-sand-100 px-3 py-1 text-sm font-medium text-sand-800">
                      {started ? STARTED_LABEL[row.status as keyof typeof STARTED_LABEL] : 'Assigned'}
                    </span>
                  </div>
                  <p className="text-base text-foreground">Recipient: {row.care_recipient_name}</p>
                  <p className="text-base text-foreground">Caregiver: {row.caregiver_name ?? '—'}</p>
                  <p className="text-base text-muted-foreground">Visit: {formatDateTime(row.requested_datetime)}</p>
                  {needsNewCaregiver && (
                    <p className="flex items-start gap-1.5 text-[16px] font-medium leading-[1.4] text-figma-danger">
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 shrink-0">
                        <circle cx="9" cy="9" r="7.5" />
                        <path d="M9 5.2v4.6M9 12.4v.1" />
                      </svg>
                      Caregiver no longer Verified — reassign
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    {!started && (
                      <ActionButton variant="secondary" disabled>
                        Reassign
                      </ActionButton>
                    )}
                    <DetailsLink id={row.id} />
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
