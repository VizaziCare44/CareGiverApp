'use server'

import { createClient } from '@/lib/supabase/server'
import { toVisitFailure, type LogTaskResult } from '@/lib/visits/action-errors'

// log_visit_task as a Server Action (DEV-066). Returns a LogTaskResult, never a raw error. The
// text goes as the note for Done and as the reason for Not done; the other is not sent.
export async function logTaskAction(bookingId: string, taskKey: string, outcome: 'done' | 'not_done', text: string): Promise<LogTaskResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'NOT_SIGNED_IN' }

  const { data, error } = await supabase.rpc('log_visit_task', {
    p_booking_id: bookingId,
    p_task_key: taskKey,
    p_outcome: outcome,
    p_note: outcome === 'done' ? text : null,
    p_reason: outcome === 'not_done' ? text : null,
  })
  if (error) return { ok: false, code: toVisitFailure('log-task', error) }

  const loggedAt = (data as { logged_at?: unknown } | null)?.logged_at
  if (typeof loggedAt !== 'string') return { ok: false, code: 'UNKNOWN' }
  return { ok: true, loggedAt }
}
