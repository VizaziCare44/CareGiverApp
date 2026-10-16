// DEV-050: one place that turns the errors of the FD-VERIFY functions (verify_caregiver,
// remove_caregiver_verification, assign_booking, change_booking_caregiver) into
// text for the screen. The raw code is never shown to a user: screens show
// `message` only. The wording here is a DRAFT pending the screen text in
// FD-VERIFY §6.1, which was not available when this was written; changing the
// text is an edit in this file and nowhere else.

export const FUNCTION_ERROR_CODES = [
  'NOT_ADMIN',
  'CAREGIVER_NOT_FOUND',
  'CAREGIVER_NOT_VERIFIED',
  'ALREADY_VERIFIED',
  'NOT_VERIFIED',
  'NOTE_REQUIRED',
  'NOTE_TOO_LONG',
  'BOOKING_NOT_FOUND',
  'BOOKING_NOT_REQUESTED',
  'BOOKING_NOT_ASSIGNED',
  'SAME_CAREGIVER',
] as const

export type FunctionErrorCode = (typeof FUNCTION_ERROR_CODES)[number]

/** NOT_SIGNED_IN: the session ended. CONNECTION: the request never completed.
 * UNKNOWN: anything the functions do not name. */
export type ActionErrorCode = FunctionErrorCode | 'NOT_SIGNED_IN' | 'CONNECTION' | 'UNKNOWN'

export type ActionName = 'verify' | 'remove' | 'assign' | 'change'

export type ActionResult = { ok: true } | { ok: false; code: ActionErrorCode }

export interface ActionErrorInfo {
  /** Screen text. Never contains a code. */
  message: string
  /** The Admin's screen is out of date: reload its data. */
  refresh: boolean
  /** Assignment screens: the chosen caregiver can no longer be assigned, drop the choice. */
  clearSelection: boolean
  /** Sending the same request again may succeed. */
  retry: boolean
}

/** Text on the button while the request is running (it is also disabled). */
export const PENDING_TEXT: Record<ActionName, string> = {
  verify: 'Saving…',
  remove: 'Saving…',
  assign: 'Assigning…',
  change: 'Assigning…',
}

const verbFor = (action: ActionName) => (action === 'assign' || action === 'change' ? 'assign' : 'save')

const STATUS_CHANGED =
  "This caregiver's status changed while you were working, so nothing was saved. The page now shows their current status."
const BOOKING_CHANGED =
  'This booking has changed since you opened it, so nothing was saved. The page now shows its current state.'

/** Plain-language text for a failed action, with what the screen should do about it. */
export function describeActionError(code: ActionErrorCode, action: ActionName): ActionErrorInfo {
  const stay = { refresh: false, clearSelection: false, retry: false }

  switch (code) {
    case 'NOTE_REQUIRED':
      return {
        ...stay,
        message: action === 'remove' ? 'Write the reason before saving.' : 'Write what you checked before saving.',
      }
    case 'NOTE_TOO_LONG':
      return { ...stay, message: 'That note is too long. Please shorten it to 1,000 characters or fewer.' }
    case 'ALREADY_VERIFIED':
    case 'NOT_VERIFIED':
      return { ...stay, refresh: true, message: STATUS_CHANGED }
    case 'CAREGIVER_NOT_VERIFIED':
      return {
        ...stay,
        refresh: true,
        clearSelection: true,
        message: "This caregiver is no longer Verified, so they can't be assigned. The list has been refreshed. Please choose another caregiver.",
      }
    case 'BOOKING_NOT_REQUESTED':
    case 'BOOKING_NOT_ASSIGNED':
      return { ...stay, refresh: true, message: BOOKING_CHANGED }
    case 'SAME_CAREGIVER':
      return { ...stay, refresh: true, message: 'This caregiver is already assigned to this booking.' }
    case 'CAREGIVER_NOT_FOUND':
      return { ...stay, refresh: true, message: "We can't find this caregiver any more. The page has been refreshed." }
    case 'BOOKING_NOT_FOUND':
      return { ...stay, refresh: true, message: "We can't find this booking any more. The page has been refreshed." }
    case 'NOT_ADMIN':
      return { ...stay, message: "You don't have permission to do this." }
    case 'NOT_SIGNED_IN':
      return { ...stay, message: 'Your session has ended. Please log in again.' }
    case 'CONNECTION':
      return { ...stay, retry: true, message: `Couldn't ${verbFor(action)} — check your connection and try again.` }
    case 'UNKNOWN':
    default:
      return { ...stay, retry: true, message: 'Something went wrong and nothing was saved. Please try again.' }
  }
}

/** Turns what PostgREST returns for a failed function call into a code. The
 * functions raise their code as the message (see backend-config migrations
 * 0007 and 0008). Anything else is UNKNOWN, never passed on as text. */
export function toActionResult(error: { message?: string | null; code?: string | null } | null | undefined): ActionResult {
  if (!error) return { ok: true }
  const message = error.message ?? ''
  const known = FUNCTION_ERROR_CODES.find((code) => code === message)
  return { ok: false, code: known ?? 'UNKNOWN' }
}
