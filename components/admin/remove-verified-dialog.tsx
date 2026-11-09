'use client'

import { useEffect, useState } from 'react'
import { ActionButton } from '@/components/ui/action-button'
import { ErrorBanner } from '@/components/ui/error-banner'
import { ModalDialog } from '@/components/ui/modal-dialog'
import { TextAreaField } from '@/components/ui/text-area-field'
import { removeCaregiverVerificationAction } from '@/app/admin/actions'
import { useAdminAction } from '@/components/admin/use-admin-action'
import { NOTE_MAX_LENGTH, REMOVE_DIALOG } from '@/lib/admin/verify-dialog-text'

/**
 * Remove Verified status (DEV-039, frame VER-04): the consequences in three short
 * paragraphs, a required reason, Cancel and the destructive button (outlined in the danger colour) at the right,
 * the button disabled until the reason is written.
 */
export function RemoveVerifiedDialog({
  open,
  caregiverId,
  name,
  onClose,
  onDone,
}: {
  open: boolean
  caregiverId: string
  name: string
  onClose: () => void
  onDone: () => void
}) {
  const { run, pending, pendingText, error, clearError } = useAdminAction('remove')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setNote('')
      clearError()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // after a "status changed" error the page behind has refreshed: saving again cannot succeed
  const stale = Boolean(error?.refresh)
  const canSubmit = note.trim() !== '' && !pending && !stale

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    const result = await run(() => removeCaregiverVerificationAction(caregiverId, note.trim()))
    if (result?.ok) onDone()
  }

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="remove-dialog-title" locked={pending}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 id="remove-dialog-title" className="text-[22px] font-bold leading-[1.25]">
          {REMOVE_DIALOG.title}
        </h2>

        <div className="flex flex-col gap-4 text-[16px] leading-[1.4]">
          <p>{REMOVE_DIALOG.consequences[0](name)}</p>
          <p>{REMOVE_DIALOG.consequences[1]()}</p>
          <p>{REMOVE_DIALOG.consequences[2]()}</p>
        </div>

        <TextAreaField
          id="remove-note"
          label={REMOVE_DIALOG.noteLabel}
          placeholder={REMOVE_DIALOG.notePlaceholder}
          value={note}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(e) => setNote(e.target.value)}
          error={error?.field === 'note' ? error.message : null}
        />

        {error && error.field !== 'note' && <ErrorBanner>{error.message}</ErrorBanner>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <ActionButton variant="secondary" disabled={pending} onClick={onClose} className="sm:w-[140px]">
            {stale ? REMOVE_DIALOG.close : REMOVE_DIALOG.cancel}
          </ActionButton>
          <ActionButton type="submit" variant="destructive" disabled={!canSubmit} className="sm:min-w-[220px]">
            {pending ? pendingText : REMOVE_DIALOG.submit}
          </ActionButton>
        </div>
      </form>
    </ModalDialog>
  )
}
