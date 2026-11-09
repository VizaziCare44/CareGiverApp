import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatusChip } from '@/components/ui/status-chip'
import { AdminMain } from '@/components/admin/admin-main'

interface CaregiverRow {
  id: string
  full_name: string
  verified: boolean
}

// FR-001 / AC-001, frames VER-01 and VER-01b. Name and status only: the status is always a
// text label plus an icon. Data comes from the caregiver_overview view
// (Admin only; DEV-034). Each row opens the Caregiver Detail screen (DEV-037).
export default async function AdminCaregiversPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('caregiver_overview')
    .select('id, full_name, verified')
    .order('full_name', { ascending: true })

  if (error) throw new Error(`Failed to load caregivers: ${error.message}`)

  const rows = (data ?? []) as CaregiverRow[]

  return (
    <AdminMain>
      <h1 className="text-[28px] font-bold leading-[1.25]">Caregivers</h1>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center rounded-[12px] border border-figma-border bg-white p-10">
          <p className="text-center text-[16px] font-semibold leading-[1.4]">
            No caregivers yet. Caregiver accounts are created by the Tech Lead or founder.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-figma-border bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="h-11 bg-figma-surface text-[13px] font-semibold leading-[1.4] text-figma-muted">
                <th scope="col" className="w-1/2 px-4 font-semibold md:w-[420px]">
                  Name
                </th>
                <th scope="col" className="px-4 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="h-14 border-t border-figma-line">
                  <td className="px-4">
                    <Link
                      href={`/admin/caregivers/${row.id}`}
                      className="inline-flex min-h-11 items-center text-[15px] font-semibold leading-[1.4] text-figma-primary underline"
                    >
                      {row.full_name}
                    </Link>
                  </td>
                  <td className="px-4">
                    <StatusChip status={row.verified ? 'verified' : 'not-verified'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminMain>
  )
}
