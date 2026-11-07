'use client'

import { ActionButton } from '@/components/ui/action-button'
import { ModalDialog } from '@/components/ui/modal-dialog'

// FR-008 / AC-006 / TC-ACC-012, frame ACC-11. Non-persistent: confirming "Leave"
// discards the in-progress selections; "Stay" just dismisses this modal. Stay is
// the filled primary button and Leave the outlined one (Button/Primary and
// Button/Secondary), in that order, one under the other.
export function LeaveWithoutFinishingModal({
  open,
  onStay,
  onLeave,
}: {
  open: boolean
  onStay: () => void
  onLeave: () => void
}) {
  return (
    <ModalDialog open={open} onClose={onStay} labelledBy="leave-modal-title" size="compact">
      <h2 id="leave-modal-title" className="text-[20px] font-bold leading-[1.25] text-figma-ink">
        Leave without finishing?
      </h2>
      <p className="text-[16px] leading-[1.4] text-figma-muted">Your progress won&apos;t be saved.</p>
      <div className="flex flex-col gap-2">
        <ActionButton className="w-full" onClick={onStay} data-testid="leave-modal-stay">
          Stay
        </ActionButton>
        <ActionButton variant="secondary" className="w-full" onClick={onLeave} data-testid="leave-modal-leave">
          Leave
        </ActionButton>
      </div>
    </ModalDialog>
  )
}
