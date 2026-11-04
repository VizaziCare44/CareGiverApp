'use server'

import { createClient } from '@/lib/supabase/server'
import { toVisitFailure, type CheckInResult, type CheckOutResult } from '@/lib/visits/action-errors'

// check_in as a Server Action (DEV-064). It returns a CheckInResult, never a raw error: the
// screen turns the code into text with describeVisitError. The time of check-in is the
// server's answer, never read from the device clock.
export async function checkInAction(bookingId: string): Promise<CheckInResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'NOT_SIGNED_IN' }

  const { data, error } = await supabase.rpc('check_in', { p_booking_id: bookingId })
  if (error) return { ok: false, code: toVisitFailure('check-in', error) }

  const checkedInAt = (data as { checked_in_at?: unknown } | null)?.checked_in_at
  if (typeof checkedInAt !== 'string') return { ok: false, code: 'UNKNOWN' }
  return { ok: true, checkedInAt }
}

// check_out as a Server Action (DEV-067). The time is the server's; the note about the visit is
// optional and sent as typed (the database trims it and holds the limit).
export async function checkOutAction(bookingId: string, visitNote: string): Promise<CheckOutResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'NOT_SIGNED_IN' }

  const { data, error } = await supabase.rpc('check_out', { p_booking_id: bookingId, p_visit_note: visitNote })
  if (error) return { ok: false, code: toVisitFailure('check-out', error) }

  const checkedOutAt = (data as { checked_out_at?: unknown } | null)?.checked_out_at
  if (typeof checkedOutAt !== 'string') return { ok: false, code: 'UNKNOWN' }
  return { ok: true, checkedOutAt }
}
