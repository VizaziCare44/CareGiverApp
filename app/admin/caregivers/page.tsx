import { createClient } from '@/lib/supabase/server'
import { StatusChip } from '@/components/ui/status-chip'

interface CaregiverRow {
  id: string
  full_name: string
  verified: boolean
}

// FR-001 / AC-001, frame VER-01. Name and status only: the status is always a
// text label plus an icon. Data comes from the caregiver_overview view
// (Admin only; DEV-034). Rows are not links yet: the Caregiver Detail screen is
// DEV-037.
export default async function AdminCaregiversPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('caregiver_overview')
    .select('id, full_name, verified')
    .order('full_name', { ascending: true })

  if (error) throw new Error(`Failed to load caregivers: ${error.message}`)

  const rows = (data ?? []) as CaregiverRow[]

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10 text-figma-ink">
      <h1 className="text-[28px] font-bold leading-9">Caregivers</h1>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-figma-line bg-white p-5">
          <p className="text-[18px] text-figma-ink">
            No caregivers yet. Caregiver accounts are created by the Tech Lead or founder.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex min-h-[64px] items-center justify-between gap-4 rounded-xl border border-figma-line bg-white px-5 py-3"
            >
              <span className="text-[18px] font-semibold">{row.full_name}</span>
              <StatusChip status={row.verified ? 'verified' : 'not-verified'} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
