'use server'

import { createClient } from '@/lib/supabase/server'
import type { FamilyBookingStatus } from '@/lib/bookings/status-label'
import { readsForBlock, type VisitReads } from '@/lib/visits/family-visit'
import { finishVisitReads, readVisitRow } from '@/lib/visits/read-family-visit'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ReloadVisitResult = { ok: true; status: FamilyBookingStatus; reads: VisitReads } | { ok: false }

// "Try again" on the visit block (DEV-075, state F5): repeats the visit reads only, never the booking
// summary or the caregiver block, which stay as they were. It also reads the booking's status (one
// column, through family_bookings), because the state depends on it and it may have changed. Returns a
// result object, never a raw error (DEV-050).
export async function reloadVisitAction(bookingId: string): Promise<ReloadVisitResult> {
  if (!UUID.test(bookingId)) return { ok: false }
  try {
    const supabase = await createClient()
    const [booking, row] = await Promise.all([
      supabase.from('family_bookings').select('status').eq('id', bookingId).maybeSingle(),
      readVisitRow(supabase, bookingId),
    ])
    if (booking.error || !booking.data) return { ok: false }
    const status = booking.data.status as FamilyBookingStatus
    return { ok: true, status, reads: readsForBlock(status, await finishVisitReads(supabase, bookingId, status, row)) }
  } catch {
    return { ok: false }
  }
}
