import { CHECKLIST, MEDICATION_ASSISTANCE_NOTES } from '@/lib/visits/assignment-text'

export interface ChecklistRow {
  task_key: string
  name: string
  is_required: boolean
}

/**
 * The checklist block, the same in every state of Assignment Detail (read-only here; the
 * tasks are logged from DEV-065 on): the heading, the line, the tasks in order with
 * Required or Optional as text, and under Medication assistance its description and the
 * if-unsure sentence.
 */
export function VisitChecklist({ items }: { items: ChecklistRow[] }) {
  return (
    <section aria-labelledby="visit-checklist-heading" className="flex flex-col gap-3 rounded-xl border border-figma-line bg-white p-5">
      <h2 id="visit-checklist-heading" className="text-[18px] font-semibold leading-[1.3]">
        {CHECKLIST.heading}
      </h2>
      <p className="text-[14px] leading-[1.4] text-figma-muted">{CHECKLIST.line}</p>
      <ol className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.task_key} data-testid="checklist-task" className="flex flex-col gap-1 border-t border-figma-line pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[16px] font-medium">{item.name}</span>
              <span className="text-[14px] text-figma-muted">{item.is_required ? CHECKLIST.required : CHECKLIST.optional}</span>
            </div>
            {item.name === MEDICATION_ASSISTANCE_NOTES.taskName && (
              <>
                <p className="text-[14px] leading-[1.4]">{MEDICATION_ASSISTANCE_NOTES.description}</p>
                <p className="text-[14px] leading-[1.4]">{MEDICATION_ASSISTANCE_NOTES.ifUnsure}</p>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
