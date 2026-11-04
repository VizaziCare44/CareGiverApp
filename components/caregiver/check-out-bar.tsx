'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionButton } from '@/components/ui/action-button'
import { AlertMessage } from '@/components/ui/alert-message'
import { ModalDialog } from '@/components/ui/modal-dialog'
import { TextAreaField } from '@/components/ui/text-area-field'
import { checkOutAction } from '@/app/assignments/[id]/actions'
import { CHECK_OUT } from '@/lib/visits/assignment-text'
import { CHECK_OUT_DIALOG, VISIT_NOTE_LIMIT } from '@/lib/visits/check-out-text'
import { checkOutReaction, type CheckOutResult } from '@/lib/visits/check-out-errors'
import { lengthOf } from '@/lib/visits/log-task-text'
import { canCheckOut, stillToLog, unloggedOptionalName, type VisitTask } from '@/lib/visits/progress'

/**
 * Check out, in the bar fixed at the bottom (VIS-06, VIS-06b, VIS-06c), and the confirmation it
 * opens (VIS-08). While any Required task has no outcome the button is disabled and the line
 * above it, which says what is still to log, is its accessible description. Once every Required
 * task is logged the button is available, with a line naming the Optional task if it has no
 * outcome yet.
 *
 * The confirmation says what checking out means, names each Optional task that will show as
 * "Not recorded", and takes an optional note about the visit. A second tap while the request
 * runs is ignored; a request that never completes becomes a message with a retry and what was
 * typed kept. When the server says a Required task is still missing, or the booking is no longer
 * the Caregiver's, the dialog closes and the screen reloads into the state that explains it. On
 * success the screen reloads into the visit summary.
 */
export function CheckOutBar({ bookingId, tasks }: { bookingId: string; tasks: VisitTask[] }) {
  const router = useRouter()
  const busy = useRef(false)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const ready = canCheckOut(tasks)
  const optional = unloggedOptionalName(tasks)
  const line = ready ? (optional ? CHECK_OUT.readyWithOptional(optional) : null) : CHECK_OUT.blocked(stillToLog(tasks))
  const unrecorded = tasks.filter((task) => !task.required && task.outcome === null)
  const tooLong = lengthOf(note) > VISIT_NOTE_LIMIT

  async function confirm() {
    if (busy.current || tooLong) return
    busy.current = true
    setPending(true)
    setMessage(null)

    let result: CheckOutResult
    try {
      result = await checkOutAction(bookingId, note)
    } catch {
      result = { ok: false, code: 'CONNECTION' }
    }

    if (result.ok) {
      router.refresh()
      // stay locked while the summary loads, so a second tap cannot send again
      return
    }

    const reaction = checkOutReaction(result.code)
    if (reaction === 'reload') {
      setOpen(false)
      router.refresh()
    } else if (reaction === 'sign-in') {
      setMessage('Your session has ended. Please log in again.')
    } else {
      setMessage(result.code === 'UNKNOWN' ? CHECK_OUT_DIALOG.unknownError : CHECK_OUT_DIALOG.notCheckedOut)
    }
    busy.current = false
    setPending(false)
  }

  function close() {
    if (pending) return
    setOpen(false)
    setMessage(null)
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-figma-line bg-white px-6 py-4" data-testid="check-out-bar">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {line && (
            <p id="check-out-line" className="text-[14px] leading-[1.4] text-figma-muted" data-testid="check-out-line">
              {line}
            </p>
          )}
          <ActionButton className="w-full" disabled={!ready} aria-describedby={line ? 'check-out-line' : undefined} onClick={() => setOpen(true)}>
            {CHECK_OUT.button}
          </ActionButton>
        </div>
      </div>

      <ModalDialog open={open} onClose={close} labelledBy="check-out-dialog-title" locked={pending}>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void confirm()
          }}
        >
          <h2 id="check-out-dialog-title" className="text-[22px] font-bold leading-[1.3]">
            {CHECK_OUT_DIALOG.title}
          </h2>
          <div className="flex flex-col gap-3 text-[16px] leading-[1.4]">
            <p>{CHECK_OUT_DIALOG.body}</p>
            {unrecorded.map((task) => (
              <p key={task.task_id} data-testid="unrecorded-line">
                {CHECK_OUT_DIALOG.optionalNotRecorded(task.name)}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <TextAreaField
              id="visit-note"
              label={CHECK_OUT_DIALOG.noteLabel}
              value={note}
              disabled={pending}
              onChange={(event) => setNote(event.target.value)}
            />
            {tooLong && (
              <p className="text-[14px] leading-[1.4] text-figma-muted" data-testid="too-long-line">
                {CHECK_OUT_DIALOG.tooLong}
              </p>
            )}
          </div>

          {message && <AlertMessage>{message}</AlertMessage>}

          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
            <ActionButton variant="secondary" disabled={pending} onClick={close}>
              {CHECK_OUT_DIALOG.back}
            </ActionButton>
            <ActionButton type="submit" disabled={pending || tooLong}>
              {pending ? CHECK_OUT_DIALOG.pending : CHECK_OUT_DIALOG.confirm}
            </ActionButton>
          </div>
        </form>
      </ModalDialog>
    </>
  )
}
