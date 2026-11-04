// DEV-069 (the part check-out needs): the errors of check_out and what the screen does about each.
// The raw code is never shown. Wording is a DRAFT pending the table in FD-VISIT §7.3.

export const CHECK_OUT_ERROR_CODES = [
  'NOT_CAREGIVER',
  'CAREGIVER_NOT_VERIFIED',
  'BOOKING_NOT_FOUND',
  'VISIT_NOT_FOUND',
  'REQUIRED_TASKS_MISSING',
  'VISIT_NOTE_TOO_LONG',
] as const

export type CheckOutErrorCode = (typeof CHECK_OUT_ERROR_CODES)[number]
export type CheckOutFailure = CheckOutErrorCode | 'NOT_SIGNED_IN' | 'CONNECTION' | 'UNKNOWN'

export type CheckOutResult = { ok: true; checkedOutAt: string } | { ok: false; code: CheckOutFailure }

/**
 * reload: close the dialog and reload the screen, which now shows the state that explains it
 *         (Check out unavailable with what is still to log; or the one "no longer available" message)
 * banner: the dialog stays open, with a message; what was typed stays
 * sign-in: the session ended
 */
export type CheckOutReaction = 'reload' | 'banner' | 'sign-in'

export function checkOutReaction(code: CheckOutFailure): CheckOutReaction {
  switch (code) {
    case 'NOT_CAREGIVER':
    case 'CAREGIVER_NOT_VERIFIED':
    case 'BOOKING_NOT_FOUND':
    case 'VISIT_NOT_FOUND':
    case 'REQUIRED_TASKS_MISSING':
      return 'reload'
    case 'NOT_SIGNED_IN':
      return 'sign-in'
    case 'VISIT_NOTE_TOO_LONG':
    case 'CONNECTION':
    case 'UNKNOWN':
    default:
      return 'banner'
  }
}

export function toCheckOutFailure(error: { message?: string | null } | null | undefined): CheckOutFailure {
  const message = error?.message ?? ''
  return CHECK_OUT_ERROR_CODES.find((code) => code === message) ?? 'UNKNOWN'
}
