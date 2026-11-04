// DEV-069 (the part Log or change a task needs): the errors of log_visit_task and what the
// screen does about each. The raw code is never shown. Wording is a DRAFT pending the table in
// FD-VISIT §7.3, which was not available.

export const LOG_TASK_ERROR_CODES = [
  'NOT_CAREGIVER',
  'CAREGIVER_NOT_VERIFIED',
  'TASK_NOT_FOUND',
  'VISIT_CLOSED',
  'INVALID_OUTCOME',
  'NOTE_REQUIRED',
  'REASON_REQUIRED',
  'NOTE_TOO_LONG',
  'REASON_TOO_LONG',
] as const

export type LogTaskErrorCode = (typeof LOG_TASK_ERROR_CODES)[number]
export type LogTaskFailure = LogTaskErrorCode | 'NOT_SIGNED_IN' | 'CONNECTION' | 'UNKNOWN'

export type LogTaskResult = { ok: true; loggedAt: string } | { ok: false; code: LogTaskFailure }

export type LogTaskReaction =
  /** the screen reloads: it now shows the one "no longer available" message */
  | 'reload'
  /** the visit was checked out: show the "already checked out" message and no edit */
  | 'closed'
  /** the "Not saved" banner with Try again; what was typed stays */
  | 'banner'
  /** the session ended */
  | 'sign-in'

export function reactionTo(code: LogTaskFailure): LogTaskReaction {
  switch (code) {
    case 'NOT_CAREGIVER':
    case 'CAREGIVER_NOT_VERIFIED':
    case 'TASK_NOT_FOUND':
      return 'reload'
    case 'VISIT_CLOSED':
      return 'closed'
    case 'NOT_SIGNED_IN':
      return 'sign-in'
    // the screen already holds these back (the Save button is unavailable); if one reaches the
    // server anyway, nothing was saved and the typed text is still on screen
    case 'INVALID_OUTCOME':
    case 'NOTE_REQUIRED':
    case 'REASON_REQUIRED':
    case 'NOTE_TOO_LONG':
    case 'REASON_TOO_LONG':
    case 'CONNECTION':
    case 'UNKNOWN':
    default:
      return 'banner'
  }
}

export function toLogTaskFailure(error: { message?: string | null } | null | undefined): LogTaskFailure {
  const message = error?.message ?? ''
  return LOG_TASK_ERROR_CODES.find((code) => code === message) ?? 'UNKNOWN'
}
