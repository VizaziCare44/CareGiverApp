// Shared shapes for FD-ACC's booking flow. bundle_code mirrors the Postgres
// enum defined in supabase/migrations/0001_init.sql — BR-001.
export type BundleCode = 'medicheck' | 'doctors_day_out'

export type BookingStatus = 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'

export interface CareRecipient {
  id: string
  account_id: string
  name: string
  care_notes: string | null
  created_at: string
}

export interface Booking {
  id: string
  account_id: string
  care_recipient_id: string
  bundle_code: BundleCode
  requested_datetime: string
  status: BookingStatus
  assigned_caregiver_id: string | null
  created_at: string
}
