'use client'

import { Button } from '@/components/ui/button'

// FR-008 / AC-006 / TC-ACC-012. Non-persistent — confirming "Leave" discards
// in-progress selections; "Stay" just dismisses this modal.
export function LeaveWithoutFinishingModal({
  open,
  onStay,
  onLeave,
}: {
  open: boolean
  onStay: () => void
  onLeave: () => void
}) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-modal">
        <h2 id="leave-modal-title" className="text-xl text-foreground">
          Leave without finishing?
        </h2>
        <p className="mt-2 text-base text-muted-foreground">Your progress won&apos;t be saved.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <Button variant="danger" className="w-full" onClick={onLeave} data-testid="leave-modal-leave">
            Leave
          </Button>
          <Button variant="secondary" className="w-full" onClick={onStay} data-testid="leave-modal-stay">
            Stay
          </Button>
        </div>
      </div>
    </div>
  )
}
