import Link from 'next/link'
import { StatusChip } from '@/components/ui/status-chip'
import { TaskTag } from '@/components/caregiver/task-tag'
import { TASKS } from '@/lib/visits/assignment-text'
import { requiredProgress, type VisitTask } from '@/lib/visits/progress'

const chips = { none: 'not-logged', done: 'task-done', not_done: 'not-done' } as const

/**
 * The Tasks card of Assignment Detail while the visit is in progress (frames VIS-06, VIS-06b,
 * VIS-06c): the count of Required tasks logged, and a row for each task with its name, the tag
 * (Required or Optional) and its state as a chip (the clock for "Not logged yet", the check for Done, the dash
 * for Not done), each with its icon and words, never colour alone. Each row opens the screen that logs or
 * changes that task (DEV-066); the chevron says so.
 */
export function VisitTasks({ bookingId, tasks }: { bookingId: string; tasks: VisitTask[] }) {
  const { logged, total } = requiredProgress(tasks)
  return (
    <section aria-labelledby="visit-tasks-heading" className="flex flex-col rounded-[14px] border border-figma-border bg-white px-4 pb-1.5 pt-3.5">
      <h2 id="visit-tasks-heading" className="text-[18px] font-semibold leading-[1.4]">
        {TASKS.heading}
      </h2>
      <p className="border-b border-figma-line pb-2 text-[14px] leading-[1.4] text-figma-muted" data-testid="tasks-progress">
        {TASKS.progress(logged, total)}
      </p>
      <ul className="flex flex-col">
        {tasks.map((task) => {
          const state = task.outcome ?? 'none'
          return (
            <li key={task.task_key} data-testid="visit-task" className="border-t border-figma-line first:border-t-0">
              <Link
                href={`/assignments/${bookingId}/tasks/${task.task_key}`}
                className="flex min-h-14 items-center gap-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary"
              >
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                  <span className="text-[16px] font-semibold leading-[1.4]">{task.name}</span>
                  <span className="flex flex-wrap items-center gap-2" data-state={state}>
                    <TaskTag required={task.is_required} />
                    <StatusChip status={chips[state]} label={TASKS.states[state]} />
                  </span>
                </span>
                <svg aria-hidden="true" className="shrink-0" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
