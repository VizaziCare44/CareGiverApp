'use server'

import { createClient } from '@/lib/supabase/server'
import { toActionResult, type ActionResult } from '@/lib/admin/action-errors'

// The four FD-VERIFY functions as Server Actions (DEV-050). They return an
// ActionResult, never a raw error: screens turn the code into text with
// describeActionError (lib/admin/action-errors.ts) through useAdminAction.
// The dialogs (DEV-038, DEV-039, DEV-043) call these.

async function call(fn: string, args: Record<string, string>): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'NOT_SIGNED_IN' }

  const { error } = await supabase.rpc(fn, args)
  return toActionResult(error)
}

export async function verifyCaregiverAction(caregiverId: string, note: string) {
  return call('verify_caregiver', { p_caregiver_id: caregiverId, p_note: note })
}

export async function removeCaregiverVerificationAction(caregiverId: string, note: string) {
  return call('remove_caregiver_verification', { p_caregiver_id: caregiverId, p_note: note })
}

export async function assignBookingAction(bookingId: string, caregiverId: string) {
  return call('assign_booking', { p_booking_id: bookingId, p_caregiver_id: caregiverId })
}

export async function changeBookingCaregiverAction(bookingId: string, caregiverId: string) {
  return call('change_booking_caregiver', { p_booking_id: bookingId, p_caregiver_id: caregiverId })
}
