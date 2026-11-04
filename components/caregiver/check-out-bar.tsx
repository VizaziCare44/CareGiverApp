import { ActionButton } from '@/components/ui/action-button'
import { CHECK_OUT } from '@/lib/visits/assignment-text'
import { canCheckOut, stillToLog, unloggedOptionalName, type VisitTask } from '@/lib/visits/progress'

/**
 * Check out, in the bar fixed at the bottom (VIS-06, VIS-06b, VIS-06c). While any Required
 * task has no outcome the button is disabled and the line above it, which says what is
 * still to log, is its accessible description. Once every Required task is logged the
 * button is available, with a line naming the Optional task if it has no outcome yet.
 *
 * The confirmation that a press opens (VIS-08) is DEV-067's: until it is built the
 * available button has nothing to open.
 */
export function CheckOutBar({ tasks }: { tasks: VisitTask[] }) {
  const ready = canCheckOut(tasks)
  const optional = unloggedOptionalName(tasks)
  const line = ready ? (optional ? CHECK_OUT.readyWithOptional(optional) : null) : CHECK_OUT.blocked(stillToLog(tasks))

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-figma-line bg-white px-6 py-4" data-testid="check-out-bar">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        {line && (
          <p id="check-out-line" className="text-[14px] leading-[1.4] text-figma-muted" data-testid="check-out-line">
            {line}
          </p>
        )}
        <ActionButton className="w-full" disabled={!ready} aria-describedby={line ? 'check-out-line' : undefined}>
          {CHECK_OUT.button}
        </ActionButton>
      </div>
    </div>
  )
}
