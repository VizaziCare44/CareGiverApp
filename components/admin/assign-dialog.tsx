'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ActionButton } from '@/components/ui/action-button'
import { AlertMessage } from '@/components/ui/alert-message'
import { ModalDialog } from '@/components/ui/modal-dialog'
import { assignBookingAction, changeBookingCaregiverAction } from '@/app/admin/actions'
import { useAdminAction } from '@/components/admin/use-admin-action'
import { ASSIGN_DIALOG, type AssignMode } from '@/lib/admin/assign-dialog-text'

/**
 * Confirm assigning (or changing to) the chosen caregiver (DEV-043). Failures use
 * the DEV-050 hook: while it runs the button reads "Assigning…" and is disabled
 * (and a second tap is ignored); a lost connection keeps the dialog open and the
 * selection, with a retry; if the booking changed underneath (already assigned, or
 * no longer assigned) the dialog says so, offers only Close and the page behind
 * refreshes; if the chosen caregiver stopped being Verified, the same, and the
 * selection is dropped. On success the Admin lands on Booking Detail, which shows
 * a banner.
 *
 * `caregiver` is the choice at the moment the dialog opened: it stays put even if
 * the screen behind drops the selection, so the dialog's own text does not change
 * under the Admin.
 */
export function AssignDialog({
  open,
  mode,
  bookingId,
  caregiver,
  previousCaregiver,
  recipient,
  onClose,
  onSelectionCleared,
}: {
  open: boolean
  mode: AssignMode
  bookingId: string
  caregiver: { id: string; name: string } | null
  previousCaregiver: string | null
  recipient: string
  onClose: () => void
  onSelectionCleared: () => void
}) {
  const router = useRouter()
  const { run, pending, pendingText, error } = useAdminAction(mode)
  const text = ASSIGN_DIALOG[mode]

  // after a conflict the page behind has refreshed: sending the same request again cannot succeed
  const stale = Boolean(error?.refresh)

  // drop the choice once the screen tells us it can no longer be made
  useEffect(() => {
    if (error?.clearSelection) onSelectionCleared()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  async function confirm(event: React.FormEvent) {
    event.preventDefault()
    if (!caregiver || pending || stale) return
    const act = mode === 'assign' ? assignBookingAction : changeBookingCaregiverAction
    const result = await run(() => act(bookingId, caregiver.id))
    if (result?.ok) router.push(`/admin/bookings/${bookingId}?banner=${mode === 'assign' ? 'assigned' : 'changed'}`)
  }

  const name = caregiver?.name ?? ''
  const consequences =
    mode === 'assign'
      ? ASSIGN_DIALOG.assign.consequences(name, recipient)
      : ASSIGN_DIALOG.change.consequences(name, recipient, previousCaregiver ?? 'The current caregiver')

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="assign-dialog-title" locked={pending}>
      <form onSubmit={confirm} className="flex flex-col gap-5">
        <h2 id="assign-dialog-title" className="text-[22px] font-bold leading-[1.3]">
          {text.title(name)}
        </h2>

        <div className="flex flex-col gap-3 text-[16px] leading-[1.4]">
          {consequences.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        {error && <AlertMessage>{error.message}</AlertMessage>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <ActionButton variant="secondary" disabled={pending} onClick={onClose}>
            {stale ? ASSIGN_DIALOG.close : ASSIGN_DIALOG.cancel}
          </ActionButton>
          <ActionButton type="submit" disabled={pending || stale}>
            {pending ? pendingText : text.submit}
          </ActionButton>
        </div>
      </form>
    </ModalDialog>
  )
}
