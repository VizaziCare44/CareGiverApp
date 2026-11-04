'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { VISIT_PENDING_TEXT, describeVisitError, type VisitActionName, type VisitErrorInfo, type VisitResult } from '@/lib/visits/action-errors'

/**
 * Runs one of the FD-VISIT Server Actions for a button or dialog (DEV-069), reusing the pattern
 * DEV-023 set for booking submit and DEV-050 for the Admin actions:
 *  - `pending` is true while the request runs: the screen shows `pendingText` ("Checking in…",
 *    "Saving…" or "Checking out…") on the button and disables it;
 *  - a second call while one is running is ignored, so a double tap cannot send twice;
 *  - a request that never completes (lost connection, the Server Action call rejects) becomes a
 *    normal error with a retry, never a button stuck on its pending text;
 *  - a failure becomes `error`, text only, never the raw code. When the screen's data is out of
 *    date the hook reloads it (`router.refresh()`) and the caller closes its dialog;
 *  - the hook never touches what the Caregiver typed, so it is still there for a retry.
 *
 * `lockOnSuccess`: after a success the screen is about to change (it reloads or moves on), so the
 * button stays locked until it does, and a second tap cannot send again.
 */
export function useVisitAction(action: VisitActionName, { lockOnSuccess = false }: { lockOnSuccess?: boolean } = {}) {
  const router = useRouter()
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<VisitErrorInfo | null>(null)

  /** Resolves with the result and, for a failure, what to do about it; null if a call was already running. */
  async function run<T>(call: () => Promise<VisitResult<T>>): Promise<{ result: VisitResult<T>; info: VisitErrorInfo | null } | null> {
    if (busy.current) return null
    busy.current = true
    setPending(true)
    setError(null)

    let result: VisitResult<T>
    try {
      result = await call()
    } catch {
      result = { ok: false, code: 'CONNECTION' }
    }

    let info: VisitErrorInfo | null = null
    if (!result.ok) {
      info = describeVisitError(result.code, action)
      setError(info)
      if (info.refresh) router.refresh()
    }

    if (!(result.ok && lockOnSuccess)) {
      busy.current = false
      setPending(false)
    }
    return { result, info }
  }

  return { run, pending, pendingText: VISIT_PENDING_TEXT[action], error, clearError: () => setError(null) }
}
