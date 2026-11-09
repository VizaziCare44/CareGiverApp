import { StatusChip } from '@/components/ui/status-chip'
import { formatDateTime, formatTime } from '@/lib/datetime'
import type { BundleCode } from '@/lib/bookings/types'
import { countLine } from '@/lib/visits/count-line'
import { reportTitle, type FamilyVisitRow, type FamilyVisitTaskRow } from '@/lib/visits/family-visit'
import { FAMILY_REPORT, FAMILY_VISIT } from '@/lib/visits/family-visit-text'

const chipFor = { done: 'done', not_done: 'not-done', not_recorded: 'not-recorded' } as const

// The caregiver's words, rendered as text and nothing else: never as HTML, markdown or a link; in full,
// with line breaks and blank lines kept (pre-wrap) and wrapped inside the card, a string with no spaces
// such as a web address included (overflow-wrap: anywhere); never cut, never behind "show more".
const words = 'whitespace-pre-wrap text-[16px] leading-[1.4] text-figma-ink [overflow-wrap:anywhere]'

/**
 * The family's visit report (DEV-076; state F3; frames FAM-03 to FAM-06; FR-003 to FR-006, FR-008, FR-010),
 * in the order of §6.1: the title; "Checked in at" and "Checked out at", each with the date and time on the
 * next line; the line that says whose words these are; (the count line, DEV-077, goes here); one block per
 * task in the order of the checklist; and, only when the caregiver wrote one, a separate card with the note
 * about the visit.
 *
 * Every piece of text is 16px or more and dark; nothing is in the muted grey. The three outcomes are one
 * neutral chip, told apart by the icon and the word. A Not done task is drawn exactly like a Done one: no
 * red, green or amber, no "Required" or "Optional", no earlier entry, no caregiver id or phone, no price.
 * An Optional task never logged shows its name and "Not recorded" and no time.
 */
export function VisitReport({ bundle, visit, tasks }: { bundle: BundleCode; visit: FamilyVisitRow; tasks: FamilyVisitTaskRow[] }) {
  const card = 'flex flex-col gap-5 rounded-[14px] border border-figma-border bg-white p-5'
  const line = countLine(tasks)
  return (
    <>
      <section aria-labelledby="report-heading" className={card} data-testid="visit-report">
        <h2 id="report-heading" className="text-[18px] font-semibold leading-[1.3] text-figma-ink">
          {reportTitle(bundle)}
        </h2>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[16px] font-medium leading-[1.4] text-figma-ink">{FAMILY_VISIT.checkedInAt}</p>
            <p className="text-[16px] leading-[1.4] text-figma-ink" data-testid="report-checked-in">
              {formatDateTime(visit.checked_in_at)}
            </p>
          </div>
          {visit.checked_out_at && (
            <div>
              <p className="text-[16px] font-medium leading-[1.4] text-figma-ink">{FAMILY_REPORT.checkedOutAt}</p>
              <p className="text-[16px] leading-[1.4] text-figma-ink" data-testid="report-checked-out">
                {formatDateTime(visit.checked_out_at)}
              </p>
            </div>
          )}
        </div>

        <p className="text-[16px] leading-[1.4] text-figma-ink">{FAMILY_REPORT.recordedBy}</p>

        {/* the count line (DEV-077): plain text, in the same dark as the rest; none for a report with no tasks */}
        {line && (
          <p className="text-[16px] leading-[1.4] text-figma-ink" data-testid="report-count-line">
            {line}
          </p>
        )}

        <ul className="flex flex-col">
          {tasks.map((task) => (
            <li key={task.sort_order} data-testid="report-task" className="flex flex-col gap-2 border-t border-figma-line py-4 first:border-t-0 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[16px] font-medium leading-[1.4] text-figma-ink [overflow-wrap:anywhere]">{task.name}</span>
                <StatusChip status={chipFor[task.outcome]} size="report" />
              </div>
              {task.logged_at && <p className="text-[16px] leading-[1.4] text-figma-ink">{FAMILY_REPORT.loggedAt(formatTime(task.logged_at))}</p>}
              {task.outcome === 'not_done' && task.reason && (
                <div>
                  <p className="text-[16px] font-medium leading-[1.4] text-figma-ink">{FAMILY_REPORT.reason}</p>
                  <p className={words}>{task.reason}</p>
                </div>
              )}
              {task.outcome === 'done' && task.note && (
                <div>
                  <p className="text-[16px] font-medium leading-[1.4] text-figma-ink">{FAMILY_REPORT.note}</p>
                  <p className={words}>{task.note}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {visit.visit_note && (
        <section aria-labelledby="report-note-heading" className={card} data-testid="visit-note-card">
          <h2 id="report-note-heading" className="text-[18px] font-semibold leading-[1.3] text-figma-ink">
            {FAMILY_REPORT.visitNoteHeading}
          </h2>
          <p className={words}>{visit.visit_note}</p>
        </section>
      )}
    </>
  )
}
