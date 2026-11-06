import { formatSpan } from '@/lib/datetime'
import { EXCEPTION_DETAILS, EXCEPTION_LABELS, STATUS_WORD, type ExceptionKind } from '@/lib/admin/exceptions-text'

// A row of public.admin_exceptions (migration 0021; FD-ADMINEXC §9) and what the Exceptions screen makes of it.
// The view returns exactly these sixteen columns and never a note, a phone number or an id of a visit, task,
// entry or caregiver (AC-015).

export interface ExceptionRow {
  booking_id: string
  requested_datetime: string
  bundle_code: 'medicheck' | 'doctors_day_out'
  recipient_name: string
  caregiver_name: string | null
  status: 'assigned' | 'in_progress' | 'completed'
  e1_no_check_in: boolean
  e2_late_check_in: boolean
  e3_check_out_outstanding: boolean
  e4_required_task_not_done: boolean
  e5_caregiver_not_verified: boolean
  e6_visit_record_missing: boolean
  minutes_since_requested: number | null
  minutes_late: number | null
  minutes_since_check_in: number | null
  not_done_tasks: { name: string; reason: string | null }[] | null
}

export interface ExceptionLine {
  kind: ExceptionKind
  label: string
  icon: (typeof EXCEPTION_LABELS)[ExceptionKind]['icon']
  /** The detail line; for E4 each task comes with its own reason instead. */
  detail: string | null
  tasks: { name: string; reason: string }[]
}

/** The exceptions of one row, in the order E1 to E6 (inside a row the blocks run E1 to E6; §7). */
export function exceptionLines(row: ExceptionRow): ExceptionLine[] {
  const line = (kind: ExceptionKind, detail: string | null, tasks: ExceptionLine['tasks'] = []): ExceptionLine => ({ kind, ...EXCEPTION_LABELS[kind], detail, tasks })
  const lines: ExceptionLine[] = []
  if (row.e1_no_check_in) lines.push(line('e1', EXCEPTION_DETAILS.e1(formatSpan(row.minutes_since_requested ?? 0))))
  if (row.e2_late_check_in) lines.push(line('e2', EXCEPTION_DETAILS.e2(formatSpan(row.minutes_late ?? 0))))
  if (row.e3_check_out_outstanding) lines.push(line('e3', EXCEPTION_DETAILS.e3(formatSpan(row.minutes_since_check_in ?? 0))))
  if (row.e4_required_task_not_done) {
    lines.push(line('e4', null, (row.not_done_tasks ?? []).map((task) => ({ name: task.name, reason: task.reason ?? '' }))))
  }
  if (row.e5_caregiver_not_verified) lines.push(line('e5', EXCEPTION_DETAILS.e5(row.caregiver_name ?? 'The caregiver')))
  if (row.e6_visit_record_missing) lines.push(line('e6', EXCEPTION_DETAILS.e6(STATUS_WORD[row.status] ?? row.status)))
  return lines
}

/** Whether a value read back from the view is a row the screen can draw (anything else is an unreadable response). */
export function isExceptionRow(value: unknown): value is ExceptionRow {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.booking_id === 'string' &&
    typeof row.requested_datetime === 'string' &&
    typeof row.recipient_name === 'string' &&
    (row.bundle_code === 'medicheck' || row.bundle_code === 'doctors_day_out') &&
    typeof row.e1_no_check_in === 'boolean' &&
    typeof row.e6_visit_record_missing === 'boolean'
  )
}
