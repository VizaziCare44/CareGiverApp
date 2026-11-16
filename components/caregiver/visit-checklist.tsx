import { TaskTag } from '@/components/caregiver/task-tag'
import { CHECKLIST, MEDICATION_ASSISTANCE_NOTES } from '@/lib/visits/assignment-text'

export interface ChecklistRow {
  task_key: string
  name: string
  is_required: boolean
}

/**
 * The checklist block, the same in every state of Assignment Detail (read-only here; the
 * tasks are logged from DEV-065 on) as frames VIS-02 to VIS-05b draw it: the heading and the line, then
 * each task with its name and Required or Optional (the tag), and under Medication assistance its
 * description and the if-unsure sentence.
 */
export function VisitChecklist({ items }: { items: ChecklistRow[] }) {
  return (
    <section aria-labelledby="visit-checklist-heading" className="flex flex-col rounded-[14px] border border-figma-border bg-white px-4 pb-1.5 pt-3.5">
      <h2 id="visit-checklist-heading" className="text-[18px] font-semibold leading-[1.4]">
        {CHECKLIST.heading}
      </h2>
      <p className="border-b border-figma-line pb-2 text-[14px] leading-[1.4] text-figma-muted">{CHECKLIST.line}</p>
      <ol className="flex flex-col">
        {items.map((item) => (
          <li key={item.task_key} data-testid="checklist-task" className="flex flex-col gap-1.5 border-t border-figma-line py-3 first:border-t-0">
            <span className="text-[16px] font-semibold leading-[1.4]">{item.name}</span>
            <span>
              <TaskTag required={item.is_required} />
            </span>
            {item.name === MEDICATION_ASSISTANCE_NOTES.taskName && (
              <>
                <p className="text-[14px] leading-[1.4] text-figma-muted">{MEDICATION_ASSISTANCE_NOTES.description}</p>
                <p className="text-[14px] leading-[1.4] text-figma-muted">{MEDICATION_ASSISTANCE_NOTES.ifUnsure}</p>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
