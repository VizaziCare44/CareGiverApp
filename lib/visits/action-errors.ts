// DEV-069: one place that turns the errors of the three FD-VISIT functions (check_in,
// log_visit_task, check_out) into what the screen does and says. It replaces the three
// separate mappings DEV-064, DEV-066 and DEV-067 each started, and follows the pattern of
// lib/admin/action-errors.ts (DEV-050). The raw code is never shown to a user: screens show
// `message` only, and a code this file does not name becomes the generic text.
//
// The table is FD-VISIT §7.3 ("Code / The screen shows"), checked against it on 2026-11-06
// (VIZ-91). Changing the text, or what a code does, is an edit in this file and nowhere else.

import { CHECK_OUT_DIALOG } from '@/lib/visits/check-out-text'
import { LOG_TASK } from '@/lib/visits/log-task-text'

export type VisitActionName = 'check-in' | 'log-task' | 'check-out'

/**
 * The codes each function raises as its error message (migration 0020, FD-VISIT §7.3), in the
 * order it checks them. BOOKING_NOT_ASSIGNED is the one code the spec does not name (TC-VIS-016
 * asks for it to be recorded): a booking that is not assigned, a cancelled one, say.
 */
export const VISIT_FUNCTION_ERRORS = {
  'check-in': ['NOT_CAREGIVER', 'BOOKING_NOT_FOUND', 'VISIT_ALREADY_CHECKED_OUT', 'BOOKING_NOT_ASSIGNED', 'NOT_VISIT_DAY', 'ANOTHER_VISIT_IN_PROGRESS'],
  'log-task': ['NOT_CAREGIVER', 'VISIT_NOT_FOUND', 'VISIT_ALREADY_CHECKED_OUT', 'TASK_NOT_FOUND', 'INVALID_OUTCOME', 'REASON_REQUIRED', 'NOTE_REQUIRED', 'TEXT_TOO_LONG'],
  'check-out': ['NOT_CAREGIVER', 'VISIT_NOT_FOUND', 'REQUIRED_TASKS_MISSING', 'TEXT_TOO_LONG'],
} as const satisfies Record<VisitActionName, readonly string[]>

export type VisitFunctionErrorCode = (typeof VISIT_FUNCTION_ERRORS)[VisitActionName][number]

/** NOT_SIGNED_IN: the session ended. CONNECTION: the request never completed. UNKNOWN: anything the functions do not name. */
export type VisitFailure = VisitFunctionErrorCode | 'NOT_SIGNED_IN' | 'CONNECTION' | 'UNKNOWN'

/** What a Server Action returns: the server's time on success, a code on failure, never a raw error. */
export type VisitResult<T> = ({ ok: true } & T) | { ok: false; code: VisitFailure }
export type CheckInResult = VisitResult<{ checkedInAt: string }>
export type LogTaskResult = VisitResult<{ loggedAt: string }>
export type CheckOutResult = VisitResult<{ checkedOutAt: string }>

export interface VisitErrorInfo {
  /** Screen text. Never contains a code. Null when the screen simply redraws into the state that explains it. */
  message: string | null
  /** The screen's data is out of date: reload it (and close the dialog, if one is open). */
  refresh: boolean
  /** The visit is already checked out: show the "already checked out" screen instead of the form (log-task only). */
  closed: boolean
  /** Sending the same request again may succeed, so the button offers "Try again". */
  retry: boolean
}

/** Text on the button while the request runs (the button is also disabled). */
export const VISIT_PENDING_TEXT: Record<VisitActionName, string> = {
  'check-in': 'Checking in…',
  'log-task': 'Saving…',
  'check-out': 'Checking out…',
}

const SIGNED_OUT = 'Your session has ended. Please log in again.'

/** The generic error text DEV-023 and DEV-050 already use (lib/admin/action-errors.ts). */
export const GENERIC_ERROR = 'Something went wrong and nothing was saved. Please try again.'

// §7.3: "No response (connection lost)": VIS-07d for a task; the same pattern for the other two.
const CONNECTION_TEXT: Record<VisitActionName, string> = {
  'check-in': 'Not saved. Check your connection and try again.',
  'log-task': 'Not saved. Check your connection and try again. What you typed is still here.',
  // §7.3 gives VIS-07d for a task and "Not saved. Check your connection and try again." for the check-in dialog; it gives no line for check-out, so this one follows the same pattern and says what did not happen
  'check-out': 'Not checked out. Check your connection and try again. What you typed is still here.',
}

/**
 * Plain-language text for a failed action, with what the screen should do about it. `limit` is the
 * length the screen was holding the text to when the server said TEXT_TOO_LONG: 500 for a reason,
 * 2,000 for a task note and for the visit note (the default).
 */
export function describeVisitError(code: VisitFailure, action: VisitActionName, context: { limit?: number } = {}): VisitErrorInfo {
  const stay = { refresh: false, closed: false, retry: false }
  const redraw = { ...stay, refresh: true, message: null }

  switch (code) {
    // BOOKING_NOT_FOUND, VISIT_NOT_FOUND: VER-12b ("This booking is no longer available to you."),
    // which the reloaded page shows when the booking is no longer the Caregiver's. The others reload
    // into the state that explains them: VIS-02 or VIS-05b (not the day), VIS-05 (another visit open),
    // VIS-06 or VIS-06b (Required tasks missing, named), or the summary (already checked out).
    case 'BOOKING_NOT_FOUND':
    case 'VISIT_NOT_FOUND':
    case 'NOT_VISIT_DAY':
    case 'ANOTHER_VISIT_IN_PROGRESS':
    case 'REQUIRED_TASKS_MISSING':
    case 'BOOKING_NOT_ASSIGNED':
      return redraw
    case 'VISIT_ALREADY_CHECKED_OUT':
      // from log_visit_task: "This visit was already checked out. Refresh to see the current state." (§6.5, Any save)
      return action === 'log-task' ? { ...stay, closed: true, message: LOG_TASK.alreadyCheckedOut } : redraw
    // The inline lines of §6.5. The screen already holds these back (Save is unavailable while the
    // text is missing), so one reaching the server is a stale or altered page. Nothing was saved and
    // what was typed stays.
    case 'NOTE_REQUIRED':
      return { ...stay, message: LOG_TASK.noteNeeded }
    case 'REASON_REQUIRED':
      return { ...stay, message: LOG_TASK.reasonNeeded }
    case 'TEXT_TOO_LONG':
      return { ...stay, message: action === 'check-out' ? CHECK_OUT_DIALOG.tooLong : LOG_TASK.tooLong(context.limit ?? 2000) }
    case 'NOT_SIGNED_IN':
      return { ...stay, message: SIGNED_OUT }
    case 'CONNECTION':
      return { ...stay, retry: true, message: CONNECTION_TEXT[action] }
    // NOT_CAREGIVER, TASK_NOT_FOUND and INVALID_OUTCOME cannot come from the screens (§7.3: "not
    // reachable from the screens"), and a code this file does not name is unknown: all show the
    // generic text.
    case 'NOT_CAREGIVER':
    case 'TASK_NOT_FOUND':
    case 'INVALID_OUTCOME':
    case 'UNKNOWN':
    default:
      return { ...stay, retry: true, message: GENERIC_ERROR }
  }
}

/**
 * Turns what PostgREST returns for a failed function call into a code. The functions raise their
 * code as the message (migration 0020). Only the codes that function can raise are trusted;
 * anything else is UNKNOWN, never passed on as text.
 */
export function toVisitFailure(action: VisitActionName, error: { message?: string | null } | null | undefined): VisitFailure {
  const message = error?.message ?? ''
  const known: readonly string[] = VISIT_FUNCTION_ERRORS[action]
  return known.includes(message) ? (message as VisitFunctionErrorCode) : 'UNKNOWN'
}
