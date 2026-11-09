import { ActionLink } from '@/components/ui/action-button'
import { StatusChip } from '@/components/ui/status-chip'
import { CHECKLIST } from '@/lib/visits/assignment-text'
import { SUMMARY } from '@/lib/visits/check-out-text'
import { formatDateTime } from '@/lib/datetime'
import type { VisitTask } from '@/lib/visits/progress'

export interface SummaryTask extends VisitTask {
  note: string | null
  reason: string | null
}

/**
 * The visit summary (VIS-09), shown in place of the assignment once the visit is checked out: the
 * status Completed with the check icon, the line about what the family can now read, the rows, each
 * task with Required or Optional and then Done, Not done with its reason, or Not recorded, and the
 * note about the visit. The times are the ones the app recorded. No score, praise or badge, and it
 * is never linked or listed: the Caregiver reaches it by the page they were on, and My Assignments
 * does not list a finished visit (FR-016, §7.8(l)).
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
      <h1 className="text-[28px] font-bold leading-9">{SUMMARY.title}</h1>
      <div className="flex flex-col items-start gap-3">
        <StatusChip status="completed" />
        <p className="text-[16px] leading-[1.4]" data-testid="summary-intro">
          {SUMMARY.intro}
        </p>
      </div>

      <section aria-label="Visit" className="flex flex-col gap-4 rounded-[14px] border border-figma-border bg-white p-5">
        <Row label={SUMMARY.careRecipient} value={recipientName} />
        <Row label={SUMMARY.bundle} value={bundleLine} />
        <Row label={SUMMARY.checkedIn} value={formatDateTime(checkedInAt)} />
        <Row label={SUMMARY.checkedOut} value={formatDateTime(checkedOutAt)} />
      </section>

      <section aria-labelledby="summary-tasks-heading" className="flex flex-col gap-3 rounded-[14px] border border-figma-border bg-white p-5">
        <h2 id="summary-tasks-heading" className="text-[18px] font-semibold leading-[1.3]">
          {SUMMARY.tasks}
        </h2>
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <li key={task.task_key} data-testid="summary-task" className="flex flex-col gap-1 border-t border-figma-line py-3 first:border-t-0 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[16px] font-medium">{task.name}</span>
                <span className="text-[14px] text-figma-muted">{task.is_required ? CHECKLIST.required : CHECKLIST.optional}</span>
              </div>
              <p className="text-[16px]" data-testid="summary-result">
                {task.outcome === 'done' ? SUMMARY.done : task.outcome === 'not_done' ? SUMMARY.notDone : SUMMARY.notRecorded}
              </p>
              {task.outcome === 'not_done' && task.reason && <p className="whitespace-pre-wrap text-[14px] leading-[1.4]">{SUMMARY.reason(task.reason)}</p>}
              {task.outcome === 'done' && task.note && <p className="whitespace-pre-wrap text-[14px] leading-[1.4]">{SUMMARY.note(task.note)}</p>}
            </li>
          ))}
        </ul>
      </section>

      {visitNote && (
        <section aria-labelledby="summary-note-heading" className="flex flex-col gap-2 rounded-[14px] border border-figma-border bg-white p-5">
          <h2 id="summary-note-heading" className="text-[18px] font-semibold leading-[1.3]">
            {SUMMARY.visitNote}
          </h2>
          <p className="whitespace-pre-wrap text-[16px] leading-[1.4]">{visitNote}</p>
        </section>
      )}

      <ActionLink href="/assignments" variant="secondary" className="self-start">
        {SUMMARY.back}
      </ActionLink>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[14px] font-medium text-figma-muted">{label}</p>
      <p className="text-[16px]">{value}</p>
    </div>
  )
}
