import { StatusChip } from '@/components/ui/status-chip'
import { TextLink } from '@/components/ui/text-link'
import { TaskTag } from '@/components/caregiver/task-tag'
import { SUMMARY } from '@/lib/visits/check-out-text'
import { formatDateTime } from '@/lib/datetime'
import type { VisitTask } from '@/lib/visits/progress'

export interface SummaryTask extends VisitTask {
  note: string | null
  reason: string | null
}

const outcomeChip = {
  done: { status: 'task-done', label: SUMMARY.done },
  not_done: { status: 'not-done', label: SUMMARY.notDone },
  none: { status: 'not-recorded', label: SUMMARY.notRecorded },
} as const

/**
 * The visit summary (frame VIS-09), shown in place of the assignment once the visit is checked out: the
 * status Completed with the check icon, the line about what the family can now read, the rows (recipient,
 * bundle, the check-in and check-out times), each task with its tag and then Done, Not done with its reason, or
 * Not recorded, and the note about the visit. The times are the ones the app recorded. No score, praise or
 * badge, and it is never linked or listed: the Caregiver reaches it by the page they were on, and My
 * Assignments does not list a finished visit (FR-016, §7.8(l)).
 */
export function VisitSummary({
  recipientName,
  bundleLine,
  checkedInAt,
  checkedOutAt,
  visitNote,
  tasks,
}: {
  recipientName: string
  bundleLine: string
  checkedInAt: string
  checkedOutAt: string
  visitNote: string | null
  tasks: SummaryTask[]
}) {
  return (
    <>
      <h1 className="sr-only">{SUMMARY.title}</h1>
      <div className="flex flex-col items-start gap-2">
        <StatusChip status="completed" />
        <p className="text-[14px] leading-[1.4] text-figma-muted" data-testid="summary-intro">
          {SUMMARY.intro}
        </p>
      </div>

      <section aria-label="Visit" className="flex flex-col rounded-[14px] border border-figma-border bg-white px-4 py-1">
        <Row label={SUMMARY.careRecipient} value={recipientName} />
        <Row label={SUMMARY.bundle} value={bundleLine} />
        <Row label={SUMMARY.checkedIn} value={formatDateTime(checkedInAt)} />
        <Row label={SUMMARY.checkedOut} value={formatDateTime(checkedOutAt)} />
      </section>

      <section aria-labelledby="summary-tasks-heading" className="flex flex-col rounded-[14px] border border-figma-border bg-white px-4 pb-1.5 pt-3.5">
        <h2 id="summary-tasks-heading" className="border-b border-figma-line pb-2 text-[18px] font-semibold leading-[1.4]">
          {SUMMARY.tasks}
        </h2>
        <ul className="flex flex-col">
          {tasks.map((task) => {
            const chip = outcomeChip[task.outcome ?? 'none']
            return (
              <li key={task.task_key} data-testid="summary-task" className="flex flex-col items-start gap-1.5 border-t border-figma-line py-3 first:border-t-0">
                <span className="text-[16px] font-semibold leading-[1.4]">{task.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <TaskTag required={task.is_required} />
                  <span data-testid="summary-result">
                    <StatusChip status={chip.status} label={chip.label} />
                  </span>
                </span>
                {task.outcome === 'not_done' && task.reason && <p className="whitespace-pre-wrap text-[14px] leading-[1.4] text-figma-muted">{SUMMARY.reason(task.reason)}</p>}
                {task.outcome === 'done' && task.note && <p className="whitespace-pre-wrap text-[14px] leading-[1.4] text-figma-muted">{SUMMARY.note(task.note)}</p>}
              </li>
            )
          })}
        </ul>
      </section>

      {visitNote && (
        <section aria-label={SUMMARY.visitNote} className="flex flex-col rounded-[14px] border border-figma-border bg-white px-4 py-1">
          <Row label={SUMMARY.visitNote} value={visitNote} />
        </section>
      )}

      <TextLink href="/assignments" className="self-start">
        {SUMMARY.back}
      </TextLink>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-figma-line py-[10px] first:border-t-0">
      <p className="text-[13px] leading-[1.4] text-figma-muted">{label}</p>
      <p className="whitespace-pre-wrap text-[16px] font-semibold leading-[1.4]">{value}</p>
    </div>
  )
}
