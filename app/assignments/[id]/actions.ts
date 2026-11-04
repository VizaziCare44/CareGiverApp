'use server'

import { createClient } from '@/lib/supabase/server'
import { toCheckInFailure, type CheckInResult } from '@/lib/visits/check-in-errors'

// check_in as a Server Action (DEV-064). It returns a CheckInResult, never a raw error: the
// screen turns the code into text with describeCheckInError. The time of check-in is the
// server's answer, never read from the device clock.
export async function checkInAction(bookingId: string): Promise<CheckInResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'NOT_SIGNED_IN' }

  const { data, error } = await supabase.rpc('check_in', { p_booking_id: bookingId })
  if (error) return { ok: false, code: toCheckInFailure(error) }

  const checkedInAt = (data as { checked_in_at?: unknown } | null)?.checked_in_at
  if (typeof checkedInAt !== 'string') return { ok: false, code: 'UNKNOWN' }
  return { ok: true, checkedInAt }
}
