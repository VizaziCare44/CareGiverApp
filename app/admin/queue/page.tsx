import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ActionLink } from '@/components/ui/action-button'
import { StatusChip } from '@/components/ui/status-chip'
import { AdminMain } from '@/components/admin/admin-main'
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

const ASSIGNED_ORDER = { assigned: 0, in_progress: 1, completed: 2 } as const

const head = 'px-4 text-left align-middle text-[13px] font-semibold leading-[1.4] text-figma-muted'
const cell = 'px-4 align-middle text-[15px] leading-[1.4]'

// The care recipient's name is the link to Booking Detail (DEV-041); the row itself is not clickable. The frames draw the
// name as plain semibold text; it is a link so there is a way into VER-06.
function RecipientLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/admin/bookings/${id}`} className="inline-flex min-h-11 items-center font-semibold text-figma-ink hover:underline focus-visible:underline">
      {name}
    </Link>
  )
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="flex items-center justify-center rounded-[12px] border border-figma-border bg-white p-10">
      <p className="text-center text-[16px] font-semibold leading-[1.4]">{children}</p>
    </div>
  )
}

// FR-006, FR-009, FR-013 / §7.6, frames VER-05 and VER-05b. DEV-022's Requested
// list, extended (DEV-040) with an Assigned tab, an "Assign caregiver" action and
// a requested-at column. The data comes from admin_booking_overview. The actions
// are separate links, never the whole row, so a stray tap on a row does
// nothing. Assign caregiver and Reassign open Choose Caregiver (DEV-042).
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
    { key: 'requested', label: 'Requested', href: '/admin/queue' },
    { key: 'assigned', label: 'Assigned', href: '/admin/queue?tab=assigned' },
  ] as const

  return (
    <AdminMain>
      <h1 className="text-[28px] font-bold leading-[1.25]">Booking Queue</h1>

      <nav aria-label="Booking queue views" className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={tab === t.key ? 'page' : undefined}
            className={[
              'inline-flex h-11 items-center px-3 text-[16px] leading-[1.4]',
              tab === t.key ? 'border-b-[3px] border-figma-primary font-bold text-figma-ink' : 'font-medium text-figma-muted',
            ].join(' ')}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'requested' ? (
        requested.length === 0 ? (
          <EmptyState>No new requests.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-figma-border bg-white">
            <table className="w-full min-w-[1000px] table-fixed border-collapse">
              <thead>
                <tr className="h-11 bg-figma-surface">
                  <th scope="col" className={`${head} w-[222px]`}>Care recipient</th>
                  <th scope="col" className={`${head} w-[202px]`}>Bundle</th>
                  <th scope="col" className={`${head} w-[262px]`}>Date and time of the visit</th>
                  <th scope="col" className={`${head} w-[242px]`}>Requested at</th>
                  <th scope="col" className={head}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requested.map((row) => (
                  <tr key={row.id} className="h-16 border-t border-figma-line">
                    <td className={cell}>
                      <RecipientLink id={row.id} name={row.care_recipient_name} />
                    </td>
                    <td className={cell}>{BUNDLES[row.bundle_code].name}</td>
                    <td className={cell}>{formatDateTime(row.requested_datetime)}</td>
                    <td className={cell}>{formatDateTime(row.created_at)}</td>
                    <td className={cell}>
                      <ActionLink href={`/admin/bookings/${row.id}/choose-caregiver`} variant="secondary" size="compact" className="min-w-[190px] whitespace-nowrap">
                          Assign caregiver
                        </ActionLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : assigned.length === 0 ? (
        <EmptyState>No assigned bookings yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-figma-border bg-white">
          <table className="w-full min-w-[1000px] table-fixed border-collapse">
            <thead>
              <tr className="h-11 bg-figma-surface">
                <th scope="col" className={`${head} w-[202px]`}>Care recipient</th>
                <th scope="col" className={`${head} w-[182px]`}>Bundle</th>
                <th scope="col" className={`${head} w-[242px]`}>Date and time of the visit</th>
                <th scope="col" className={`${head} w-[392px]`}>Caregiver</th>
                <th scope="col" className={head}>Action</th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((row) => {
                const started = row.status === 'in_progress' || row.status === 'completed'
                // reassignment is not available once a visit starts (AC-008), so no flag and no entry then
                const needsNewCaregiver = !started && row.caregiver_verified === false
                return (
                  <tr key={row.id} className="h-[76px] border-t border-figma-line">
                    <td className={cell}>
                      <RecipientLink id={row.id} name={row.care_recipient_name} />
                    </td>
                    <td className={cell}>{BUNDLES[row.bundle_code].name}</td>
                    <td className={cell}>{formatDateTime(row.requested_datetime)}</td>
                    <td className={cell}>
                      <div className="flex flex-col items-start gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{row.caregiver_name ?? '—'}</span>
                          {row.caregiver_name && <StatusChip status={row.caregiver_verified ? 'verified' : 'not-verified'} />}
                        </div>
                        {needsNewCaregiver && (
                          <p className="flex items-center gap-1.5 text-[14px] font-semibold leading-[1.4] text-figma-ambertext">
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <path d="M10 2.5l8 14H2z" />
                              <path d="M10 8v4M10 14.2v.1" />
                            </svg>
                            Caregiver no longer Verified — reassign
                          </p>
                        )}
                      </div>
                    </td>
                    <td className={cell}>
                                              {started ? (
                          <StatusChip status={row.status === 'in_progress' ? 'in-progress' : 'completed'} />
                        ) : (
                          <ActionLink href={`/admin/bookings/${row.id}/choose-caregiver`} variant="secondary" size="compact" className="min-w-[170px] whitespace-nowrap">
                            {needsNewCaregiver ? 'Reassign' : 'Change caregiver'}
                          </ActionLink>
                        )}

                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminMain>
  )
}
