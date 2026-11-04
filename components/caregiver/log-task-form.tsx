'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionButton, ActionLink } from '@/components/ui/action-button'
import { AlertMessage } from '@/components/ui/alert-message'
import { TextAreaField } from '@/components/ui/text-area-field'
import { logTaskAction } from '@/app/assignments/[id]/tasks/[taskId]/actions'
import { useVisitAction } from '@/components/caregiver/use-visit-action'
import { LOG_TASK, NOTE_LIMIT, REASON_LIMIT, fieldFor, lengthOf } from '@/lib/visits/log-task-text'
import { formatTime } from '@/lib/datetime'

type Outcome = 'done' | 'not_done'

export interface CurrentEntry {
  outcome: Outcome
  note: string | null
  reason: string | null
  loggedAt: string
}

/**
 * Log or change a task (VIS-07 to VIS-07d). Done and Not done are two equal buttons side by
 * side; once one is chosen the note (Done) or the reason (Not done) field appears with its
 * label and prompt. Save is unavailable until a required text is written and while the text
 * is over its limit; the lines that say why are plain text, not in an error colour. The text
 * is never cut: there is no maxlength, the over-the-limit line names the limit instead. What
 * is typed stays in memory on the screen across a failed save, and a retry is safe because
 * the database treats an identical repeat as no change. A task that already has an entry
 * opens on that entry, and saving writes a new one (the earlier stays in the visit record).
 */
export function LogTaskForm({
  bookingId,
  taskId,
  taskName,
  noteRequired,
  current,
}: {
  bookingId: string
  taskId: string
  taskName: string
  noteRequired: boolean
  current: CurrentEntry | null
}) {
  const router = useRouter()
  // after a success the screen moves to the assignment, so the form stays locked until it does
  const { run, pending, pendingText, error } = useVisitAction('log-task', { lockOnSuccess: true })
  const [outcome, setOutcome] = useState<Outcome | null>(current?.outcome ?? null)
  const [note, setNote] = useState(current?.note ?? '')
  const [reason, setReason] = useState(current?.reason ?? '')

  const field = outcome ? fieldFor(taskName, outcome, noteRequired) : null

  const text = outcome === 'done' ? note : reason
  const limit = outcome === 'done' ? NOTE_LIMIT : REASON_LIMIT
  const empty = text.trim() === ''
  const tooLong = lengthOf(text) > limit
  const needsText = outcome === 'not_done' ? true : outcome === 'done' ? noteRequired : false
  const missing = outcome !== null && needsText && empty
  const canSave = outcome !== null && !missing && !tooLong && !pending

  async function save() {
    if (!outcome || !canSave) return
    const done = await run(() => logTaskAction(taskId, outcome, text))
    if (done?.result.ok) {
      router.push(`/assignments/${bookingId}`)
      router.refresh()
    }
  }

  if (error?.closed) {
    return (
      <div className="flex flex-col gap-4" data-testid="already-checked-out">
        <p className="text-[16px] leading-[1.4]">{LOG_TASK.alreadyCheckedOut}</p>
        <ActionLink href={`/assignments/${bookingId}`} variant="secondary" className="self-start">
          {LOG_TASK.backToAssignment}
        </ActionLink>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[14px] font-medium text-figma-ink">{LOG_TASK.outcomeLegend}</legend>
        <div role="radiogroup" aria-label={LOG_TASK.outcomeLegend} className="grid grid-cols-2 gap-3">
          {(['done', 'not_done'] as const).map((value) => {
            const selected = outcome === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => setOutcome(value)}
                className={[
                  'inline-flex h-12 items-center justify-center gap-2 rounded-[10px] px-4 text-[16px] font-semibold leading-[1.4]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed',
                  selected ? 'bg-figma-primary text-white' : 'border-2 border-figma-primary bg-white text-figma-primary',
                ].join(' ')}
              >
                {selected && (
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                )}
                {value === 'done' ? LOG_TASK.done : LOG_TASK.notDone}
              </button>
            )
          })}
        </div>
      </fieldset>

      {outcome && field && (
        <div className="flex flex-col gap-2">
          <TextAreaField
            id="task-text"
            label={field.label}
            helper={field.prompt}
            value={text}
            disabled={pending}
            onChange={(event) => (outcome === 'done' ? setNote(event.target.value) : setReason(event.target.value))}
          />
          {field.after && outcome === 'done' && <p className="text-[14px] leading-[1.4] text-figma-muted">{field.after}</p>}
          {missing && (
            <p className="text-[14px] leading-[1.4] text-figma-muted" data-testid="needed-line">
              {outcome === 'done' ? LOG_TASK.noteNeeded : LOG_TASK.reasonNeeded}
            </p>
          )}
          {tooLong && (
            <p className="text-[14px] leading-[1.4] text-figma-muted" data-testid="too-long-line">
              {LOG_TASK.tooLong(limit)}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className="text-[14px] leading-[1.4] text-figma-muted" data-testid="change-line">
          {current ? LOG_TASK.loggedAs(current.outcome === 'done' ? 'Done' : 'Not done', formatTime(current.loggedAt)) : LOG_TASK.changeLine}
        </p>

        {error?.message && <AlertMessage>{error.message}</AlertMessage>}

        <ActionButton type="submit" disabled={!canSave} className="w-full">
          {pending ? pendingText : error?.retry ? LOG_TASK.tryAgain : current ? LOG_TASK.saveChange : LOG_TASK.save}
        </ActionButton>
      </div>
    </form>
  )
}
