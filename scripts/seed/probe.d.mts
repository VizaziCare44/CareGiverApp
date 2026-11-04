import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProbeOffender {
  kind:
    | 'BOOKING_WITHOUT_VISIT'
    | 'STATUS_MISMATCH'
    | 'WRONG_CAREGIVER'
    | 'SNAPSHOT_MISMATCH'
    | 'REQUIRED_TASK_NOT_LOGGED'
    | 'ENTRY_OUTSIDE_VISIT'
    | 'ENTRY_WITHOUT_TEXT'
    | 'TWO_OPEN_VISITS'
    | 'CLOSED_BEFORE_OPEN'
  [detail: string]: unknown
}
export function probe(supabase: SupabaseClient, options?: { bookingIds?: string[] }): Promise<ProbeOffender[]>
