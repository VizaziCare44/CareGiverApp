// DEV-069 (the part check-in needs): one place that turns the errors of check_in into
// what the screen does about them. The raw code is never shown to a user. The wording of
// the messages is a DRAFT pending the table in FD-VISIT §7.3, which was not available.

export const CHECK_IN_ERROR_CODES = [
  'NOT_CAREGIVER',
  'CAREGIVER_NOT_VERIFIED',
  'BOOKING_NOT_FOUND',
  'BOOKING_NOT_ASSIGNED',
  'NOT_VISIT_DAY',
  'ANOTHER_VISIT_IN_PROGRESS',
] as const

export type CheckInErrorCode = (typeof CHECK_IN_ERROR_CODES)[number]

/** NOT_SIGNED_IN: the session ended. CONNECTION: the request never completed. UNKNOWN: anything not named. */
export type CheckInFailure = CheckInErrorCode | 'NOT_SIGNED_IN' | 'CONNECTION' | 'UNKNOWN'

export type CheckInResult = { ok: true; checkedInAt: string } | { ok: false; code: CheckInFailure }

export interface CheckInErrorInfo {
  /** Text for the dialog. Null when the screen simply redraws into the state that explains it. */
  message: string | null
  /** The screen's data is out of date: close the dialog and reload it. */
  refresh: boolean
  /** Sending the same request again may succeed. */
  retry: boolean
}

/** Text on the button while the request is running (it is also disabled). */
export const CHECK_IN_PENDING_TEXT = 'Checking in…'

export function describeCheckInError(code: CheckInFailure): CheckInErrorInfo {
  switch (code) {
    // the screen reloads into VIS-02 / VIS-05b (not the day) or VIS-05 (another visit open)
    case 'NOT_VISIT_DAY':
    case 'ANOTHER_VISIT_IN_PROGRESS':
    // the booking is no longer the Caregiver's to check in to: the reload shows the one message for that
    case 'BOOKING_NOT_FOUND':
    case 'BOOKING_NOT_ASSIGNED':
    case 'CAREGIVER_NOT_VERIFIED':
    case 'NOT_CAREGIVER':
      return { message: null, refresh: true, retry: false }
    case 'NOT_SIGNED_IN':
      return { message: 'Your session has ended. Please log in again.', refresh: false, retry: false }
    case 'CONNECTION':
      return { message: "Couldn't check in — check your connection and try again.", refresh: false, retry: true }
    case 'UNKNOWN':
    default:
      return { message: 'Something went wrong and you are not checked in. Please try again.', refresh: false, retry: true }
  }
}

/** Turns what PostgREST returns for a failed check_in call into a code. The function raises its
 * code as the message (migration 0012); anything else is UNKNOWN, never passed on as text. */
export function toCheckInFailure(error: { message?: string | null } | null | undefined): CheckInFailure {
  const message = error?.message ?? ''
  return CHECK_IN_ERROR_CODES.find((code) => code === message) ?? 'UNKNOWN'
}
