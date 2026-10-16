'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  describeActionError,
  PENDING_TEXT,
  type ActionErrorInfo,
  type ActionName,
  type ActionResult,
} from '@/lib/admin/action-errors'

/**
 * Runs one of the FD-VERIFY Server Actions for a dialog or screen (DEV-050),
 * reusing the pattern DEV-023 set for booking submit:
 *  - `pending` is true while the request runs: the screen shows `pendingText`
 *    ("Saving…" or "Assigning…") on the button and disables it;
 *  - a second call while one is running is ignored (a double tap cannot send twice);
 *  - a request that never completes (lost connection, the Server Action call
 *    rejects) becomes a normal error with a retry, never a button stuck on
 *    "Saving…";
 *  - a failure becomes `error`, text only, never the raw code. If the screen's
 *    data is out of date the hook reloads it (`router.refresh()`);
 *  - the hook never touches what the Admin typed or chose, so the note or the
 *    selection is still there for a retry. `error.clearSelection` tells an
 *    assignment screen to drop a choice that can no longer be made.
 */
export function useAdminAction(action: ActionName) {
  const router = useRouter()
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ActionErrorInfo | null>(null)

  /** Resolves with the result, or null if a call was already running. */
  async function run(call: () => Promise<ActionResult>): Promise<ActionResult | null> {
    if (busy.current) return null
    busy.current = true
    setPending(true)
    setError(null)

    let result: ActionResult
    try {
      result = await call()
    } catch {
      result = { ok: false, code: 'CONNECTION' }
    }

    if (!result.ok) {
      const info = describeActionError(result.code, action)
      setError(info)
      if (info.refresh) router.refresh()
    }

    busy.current = false
    setPending(false)
    return result
  }

  return { run, pending, pendingText: PENDING_TEXT[action], error, clearError: () => setError(null) }
}
