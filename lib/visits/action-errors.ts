// DEV-069: one place that turns the errors of the three FD-VISIT functions (check_in,
// log_visit_task, check_out) into what the screen does and says. It replaces the three
// separate mappings DEV-064, DEV-066 and DEV-067 each started, and follows the pattern of
// lib/admin/action-errors.ts (DEV-050). The raw code is never shown to a user: screens show
// `message` only, and a code this file does not name becomes the generic text.
//
// The wording is a DRAFT pending the table in FD-VISIT §7.3, which was not available when
// this was written. Changing the text, or what a code does, is an edit in this file and
// nowhere else.

import { CHECK_OUT_DIALOG } from '@/lib/visits/check-out-text'
import { LOG_TASK } from '@/lib/visits/log-task-text'

export type VisitActionName = 'check-in' | 'log-task' | 'check-out'

/** The codes each function raises as its error message (migrations 0012, 0015, 0016), in the order it checks them. */
export const VISIT_FUNCTION_ERRORS = {
  'check-in': ['NOT_CAREGIVER', 'CAREGIVER_NOT_VERIFIED', 'BOOKING_NOT_FOUND', 'BOOKING_NOT_ASSIGNED', 'NOT_VISIT_DAY', 'ANOTHER_VISIT_IN_PROGRESS'],
  'log-task': [
    'NOT_CAREGIVER',
    'CAREGIVER_NOT_VERIFIED',
    'TASK_NOT_FOUND',
    'VISIT_CLOSED',
    'INVALID_OUTCOME',
    'NOTE_REQUIRED',
    'REASON_REQUIRED',
    'NOTE_TOO_LONG',
    'REASON_TOO_LONG',
  ],
  'check-out': ['NOT_CAREGIVER', 'CAREGIVER_NOT_VERIFIED', 'BOOKING_NOT_FOUND', 'VISIT_NOT_FOUND', 'VISIT_NOTE_TOO_LONG', 'REQUIRED_TASKS_MISSING'],
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

const CONNECTION_TEXT: Record<VisitActionName, string> = {
  'check-in': "Couldn't check in — check your connection and try again.",
  'log-task': 'Not saved. Check your connection and try again. What you typed is still here.',
  'check-out': 'Not checked out. Check your connection and try again. What you typed is still here.',
}

const UNKNOWN_TEXT: Record<VisitActionName, string> = {
  'check-in': 'Something went wrong and you are not checked in. Please try again.',
  'log-task': 'Not saved. Something went wrong. Try again. What you typed is still here.',
  'check-out': 'Not checked out. Something went wrong. Try again. What you typed is still here.',
}

/** Plain-language text for a failed action, with what the screen should do about it. */
export function describeVisitError(code: VisitFailure, action: VisitActionName): VisitErrorInfo {
  const stay = { refresh: false, closed: false, retry: false }
  const redraw = { ...stay, refresh: true, message: null }

  switch (code) {
    // The booking or visit is no longer the Caregiver's, or the day or the other visit changed:
    // the reloaded screen is the explanation (the one "no longer available" message, VIS-02,
    // VIS-05 or VIS-05b, or Check out unavailable with what is still to log).
    case 'NOT_CAREGIVER':
    case 'CAREGIVER_NOT_VERIFIED':
    case 'BOOKING_NOT_FOUND':
    case 'BOOKING_NOT_ASSIGNED':
    case 'NOT_VISIT_DAY':
    case 'ANOTHER_VISIT_IN_PROGRESS':
    case 'TASK_NOT_FOUND':
    case 'VISIT_NOT_FOUND':
    case 'REQUIRED_TASKS_MISSING':
      return redraw
    case 'VISIT_CLOSED':
      return { ...stay, closed: true, message: LOG_TASK.alreadyCheckedOut }
    // The screen already holds these back (Save and Check out are unavailable while the text is
    // missing or over its limit), so one reaching the server is a stale or altered page. Nothing
    // was saved and what was typed stays.
    case 'NOTE_REQUIRED':
      return { ...stay, message: LOG_TASK.noteNeeded }
    case 'REASON_REQUIRED':
      return { ...stay, message: LOG_TASK.reasonNeeded }
    case 'NOTE_TOO_LONG':
      return { ...stay, message: LOG_TASK.tooLong(2000) }
    case 'REASON_TOO_LONG':
      return { ...stay, message: LOG_TASK.tooLong(500) }
    case 'VISIT_NOTE_TOO_LONG':
      return { ...stay, message: CHECK_OUT_DIALOG.tooLong }
    case 'NOT_SIGNED_IN':
      return { ...stay, message: SIGNED_OUT }
    case 'CONNECTION':
      return { ...stay, retry: true, message: CONNECTION_TEXT[action] }
    // INVALID_OUTCOME cannot come from the screen (it only sends Done or Not done), so it reads as
    // any other failure the screen cannot explain.
    case 'INVALID_OUTCOME':
    case 'UNKNOWN':
    default:
      return { ...stay, retry: true, message: UNKNOWN_TEXT[action] }
  }
}

/**
 * Turns what PostgREST returns for a failed function call into a code. The functions raise their
 * code as the message (migrations 0012, 0015, 0016). Only the codes that function can raise are
 * trusted; anything else is UNKNOWN, never passed on as text.
 */
export function toVisitFailure(action: VisitActionName, error: { message?: string | null } | null | undefined): VisitFailure {
  const message = error?.message ?? ''
  const known: readonly string[] = VISIT_FUNCTION_ERRORS[action]
  return known.includes(message) ? (message as VisitFunctionErrorCode) : 'UNKNOWN'
}
