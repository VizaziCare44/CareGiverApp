'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionButton } from '@/components/ui/action-button'
import { AlertMessage } from '@/components/ui/alert-message'
import { ModalDialog } from '@/components/ui/modal-dialog'
import { checkInAction } from '@/app/assignments/[id]/actions'
import { useVisitAction } from '@/components/caregiver/use-visit-action'
import { CHECK_IN_DIALOG, checkedInLine } from '@/lib/visits/assignment-text'
import { formatTime } from '@/lib/datetime'

/**
 * The Check in button in the bar fixed at the bottom of the screen (VIS-03, VIS-03b) and
 * the dialog it opens (VIS-04). A second tap while the request runs is ignored; a request
 * that never completes becomes an error with a retry, never a button stuck on "Checking
 * in…". After success the time shown is the server's answer. When the server says it is
 * not the day, or another visit is open, the dialog closes and the screen reloads into the
 * state that explains it.
 */
export function CheckInBar({ bookingId, recipientName, bundleLine }: { bookingId: string; recipientName: string; bundleLine: string }) {
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
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-figma-line bg-white px-6 py-4" data-testid="check-in-bar">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {checkedInAt ? (
            <p role="status" className="text-[16px] font-medium">
              {checkedInLine(formatTime(checkedInAt))}
            </p>
          ) : (
            <ActionButton className="w-full" onClick={() => setOpen(true)}>
              {CHECK_IN_DIALOG.confirm}
            </ActionButton>
          )}
        </div>
      </div>

      <ModalDialog open={open} onClose={close} labelledBy="check-in-dialog-title" locked={pending}>
        <h2 id="check-in-dialog-title" className="text-[22px] font-bold leading-[1.3]">
          {CHECK_IN_DIALOG.title}
        </h2>
        <div className="flex flex-col gap-2 text-[16px] leading-[1.4]">
          <p className="font-medium">{CHECK_IN_DIALOG.detail(recipientName, bundleLine)}</p>
          <p>{CHECK_IN_DIALOG.body}</p>
        </div>
        {error?.message && <AlertMessage>{error.message}</AlertMessage>}
        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <ActionButton variant="secondary" disabled={pending} onClick={close}>
            {CHECK_IN_DIALOG.cancel}
          </ActionButton>
          <ActionButton disabled={pending} onClick={confirm}>
            {pending ? pendingText : CHECK_IN_DIALOG.confirm}
          </ActionButton>
        </div>
      </ModalDialog>
    </>
  )
}
