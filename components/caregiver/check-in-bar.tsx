'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionButton } from '@/components/ui/action-button'
import { ErrorBanner } from '@/components/ui/error-banner'
import { ModalDialog } from '@/components/ui/modal-dialog'
import { checkInAction } from '@/app/assignments/[id]/actions'
import { useVisitAction } from '@/components/caregiver/use-visit-action'
import { CHECK_IN_DIALOG, checkedInLine } from '@/lib/visits/assignment-text'
import { formatDateTime } from '@/lib/datetime'

/**
 * The Check in button in the bar fixed at the bottom of the screen (VIS-03, VIS-03b) and
 * the dialog it opens (VIS-04). A second tap while the request runs is ignored; a request
 * that never completes becomes an error with a retry, never a button stuck on "Checking
 * in…". After success the time shown is the server's answer. When the server says it is
 * not the day, or another visit is open, the dialog closes and the screen reloads into the
 * state that explains it.
 */
export function CheckInBar({ bookingId, recipientName, bundleName, visitDate }: { bookingId: string; recipientName: string; bundleName: string; visitDate: string }) {
  const router = useRouter()
  const { run, pending, pendingText, error, clearError } = useVisitAction('check-in')
  const [open, setOpen] = useState(false)
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null)

  async function confirm() {
    const outcome = await run(() => checkInAction(bookingId))
    if (!outcome) return
    if (outcome.result.ok) {
      setCheckedInAt(outcome.result.checkedInAt)
      setOpen(false)
      router.refresh()
    } else if (outcome.info?.refresh) {
      setOpen(false)
    }
  }

  function close() {
    if (pending) return
    setOpen(false)
    clearError()
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-figma-line bg-white px-5 py-4" data-testid="check-in-bar">
        <div className="mx-auto flex max-w-md flex-col gap-[10px]">
          {checkedInAt ? (
            <p role="status" className="text-[15px] font-semibold">
              {checkedInLine(formatDateTime(checkedInAt))}
            </p>
          ) : (
            <ActionButton className="w-full" onClick={() => setOpen(true)}>
              {CHECK_IN_DIALOG.confirm}
            </ActionButton>
          )}
        </div>
      </div>

      <ModalDialog open={open} onClose={close} labelledBy="check-in-dialog-title" locked={pending} size="compact">
        <h2 id="check-in-dialog-title" className="text-[20px] font-bold leading-[1.3]">
          {CHECK_IN_DIALOG.title}
        </h2>
        <p className="text-[15px] leading-[1.4] text-figma-muted">{CHECK_IN_DIALOG.detail(recipientName, bundleName, visitDate)}</p>
        <p className="text-[16px] leading-[1.4]">{CHECK_IN_DIALOG.body}</p>
        {error?.message && <ErrorBanner>{error.message}</ErrorBanner>}
        {/* frame VIS-04: the two buttons one under the other, the action first */}
        <div className="flex flex-col gap-3">
          <ActionButton disabled={pending} onClick={confirm} className="w-full">
            {pending ? pendingText : CHECK_IN_DIALOG.confirm}
          </ActionButton>
          <ActionButton variant="secondary" disabled={pending} onClick={close} className="w-full">
            {CHECK_IN_DIALOG.cancel}
          </ActionButton>
        </div>
      </ModalDialog>
    </>
  )
}
