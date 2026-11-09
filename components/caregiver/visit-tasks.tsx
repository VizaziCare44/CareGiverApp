import Link from 'next/link'
import { CHECKLIST, TASKS } from '@/lib/visits/assignment-text'
import { requiredProgress, type VisitTask } from '@/lib/visits/progress'

const icons = {
  none: <circle cx="8" cy="8" r="5.75" />,
  done: <path d="M3.5 8.5l3 3 6-7" />,
  not_done: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
}

/**
 * The Tasks card of Assignment Detail while the visit is in progress (VIS-06, VIS-06b,
 * VIS-06c): the count of Required tasks logged, and a row for each task with its name,
 * Required or Optional as text, and its state as text plus an icon (never colour alone).
 * Each row opens the screen that logs or changes that task (DEV-066).
 */
export function VisitTasks({ bookingId, tasks }: { bookingId: string; tasks: VisitTask[] }) {
  const { logged, total } = requiredProgress(tasks)
  return (
    <section aria-labelledby="visit-tasks-heading" className="flex flex-col gap-3 rounded-[14px] border border-figma-border bg-white p-5">
      <h2 id="visit-tasks-heading" className="text-[18px] font-semibold leading-[1.3]">
        {TASKS.heading}
      </h2>
      <p className="text-[14px] leading-[1.4] text-figma-muted" data-testid="tasks-progress">
        {TASKS.progress(logged, total)}
      </p>
      <ul className="flex flex-col">
        {tasks.map((task) => {
          const state = task.outcome ?? 'none'
          return (
            <li key={task.task_key} data-testid="visit-task" className="border-t border-figma-line first:border-t-0">
              <Link
                href={`/assignments/${bookingId}/tasks/${task.task_key}`}
                className="flex min-h-14 items-center justify-between gap-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[16px] font-medium">{task.name}</span>
                  <span className="text-[14px] text-figma-muted">{task.is_required ? CHECKLIST.required : CHECKLIST.optional}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[14px] font-medium" data-state={state}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {icons[state]}
                  </svg>
                  {TASKS.states[state]}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
