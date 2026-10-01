import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { BUNDLES } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'

interface QueueRow {
  id: string
  bundle_code: BundleCode
  requested_datetime: string
  created_at: string
  care_recipients: { name: string } | null
  profiles: { full_name: string; phone: string } | null
}

// FR-006 / §7.6. View-only — no assignment action here, that's FD-VERIFY.
export default async function AdminQueuePage() {
  const supabase = await createClient()
  // `profiles` is qualified by FK name — bookings has two FKs into profiles
  // (account_id and assigned_caregiver_id), so an unqualified `profiles(...)`
  // embed is ambiguous and PostgREST rejects it (PGRST201). Confirmed live:
  // the unqualified version failed silently here (data came back null, no
  // error was checked) and rendered "No new requests" despite real rows.
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, bundle_code, requested_datetime, created_at, care_recipients(name), profiles!bookings_account_id_fkey(full_name, phone)',
    )
    .eq('status', 'requested')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to load booking queue: ${error.message}`)

  const rows = (data ?? []) as unknown as QueueRow[]

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl text-foreground">Booking queue</h1>

      {rows.length === 0 ? (
        <Card>
          <p className="text-lg text-muted-foreground">No new requests.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <Card key={row.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium text-foreground">{BUNDLES[row.bundle_code].name}</span>
                <span className="rounded-full bg-sand-100 px-3 py-1 text-sm font-medium text-sand-800">Requested</span>
              </div>
              <p className="text-base text-foreground">Recipient: {row.care_recipients?.name ?? '—'}</p>
              <p className="text-base text-muted-foreground">
                Requested by {row.profiles?.full_name ?? '—'} · {row.profiles?.phone ?? '—'}
              </p>
              <p className="text-base text-muted-foreground">
                {new Date(row.requested_datetime).toLocaleString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
