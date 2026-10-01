'use server'

import { createClient } from '@/lib/supabase/server'
import type { BundleCode } from '@/lib/bookings/types'

// FR-006 / AC-003. BR-001/BR-002 are enforced at the database level (enum +
// NOT NULL FK, supabase/migrations/0001_init.sql) — this action doesn't
// re-validate bundle_code itself, matching FD-ACC §7.3's point that the
// enum is the real enforcement, not the API layer.
export async function submitBooking({
  careRecipientId,
  bundleCode,
  requestedDatetime,
}: {
  careRecipientId: string
  bundleCode: BundleCode
  requestedDatetime: string
}): Promise<{ error?: string; bookingId?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      account_id: user.id,
      care_recipient_id: careRecipientId,
      bundle_code: bundleCode,
      requested_datetime: requestedDatetime,
      status: 'requested',
    })
    .select('id')
    .single()

  if (error) return { error: "Couldn't submit — check your connection and try again." }
  return { bookingId: data.id }
}
