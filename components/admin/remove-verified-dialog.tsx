'use client'

import { useEffect, useState } from 'react'
import { ActionButton } from '@/components/ui/action-button'
import { AlertMessage } from '@/components/ui/alert-message'
import { ModalDialog } from '@/components/ui/modal-dialog'
import { TextAreaField } from '@/components/ui/text-area-field'
import { removeCaregiverVerificationAction } from '@/app/admin/actions'
import { useAdminAction } from '@/components/admin/use-admin-action'
import { NOTE_MAX_LENGTH, REMOVE_DIALOG, removeHint } from '@/lib/admin/verify-dialog-text'

/**
 * Remove Verified status (DEV-039, frame VER-04): the consequences in three short
 * paragraphs, a required reason, and a destructive button that is set apart from
 * the safe choice by its wording ("Remove Verified status", not "Confirm"), by
 * its style (outlined in the danger colour) and by its place: Cancel takes the
 * usual confirm position and comes first for the keyboard, the destructive button
 * sits beside it, never in the primary position.
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

  const hint = removeHint(note)
  // after a "status changed" error the page behind has refreshed: saving again cannot succeed
  const stale = Boolean(error?.refresh)
  const canSubmit = hint === null && !pending && !stale

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    const result = await run(() => removeCaregiverVerificationAction(caregiverId, note.trim()))
    if (result?.ok) onDone()
  }

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="remove-dialog-title" locked={pending}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <h2 id="remove-dialog-title" className="text-[22px] font-bold leading-[1.3]">
          {REMOVE_DIALOG.title(name)}
        </h2>

        <div className="flex flex-col gap-3 text-[16px] leading-[1.4]">
          <p>{REMOVE_DIALOG.consequences[0](name)}</p>
          <p>{REMOVE_DIALOG.consequences[1](name)}</p>
          <p>{REMOVE_DIALOG.consequences[2]()}</p>
        </div>

        <TextAreaField
          id="remove-note"
          label={REMOVE_DIALOG.noteLabel}
          helper={REMOVE_DIALOG.noteHelper}
          value={note}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(e) => setNote(e.target.value)}
          error={error?.field === 'note' ? error.message : null}
        />

        {error && error.field !== 'note' && <AlertMessage>{error.message}</AlertMessage>}

        <div className="flex flex-col gap-2">
          {hint && !pending && !stale && (
            <p id="remove-hint" className="text-[14px] leading-[1.4] text-figma-muted">
              {hint}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
            <ActionButton variant="secondary" disabled={pending} onClick={onClose}>
              {stale ? REMOVE_DIALOG.close : REMOVE_DIALOG.cancel}
            </ActionButton>
            <ActionButton type="submit" variant="destructive" disabled={!canSubmit} aria-describedby={hint ? 'remove-hint' : undefined}>
              {pending ? pendingText : REMOVE_DIALOG.submit}
            </ActionButton>
          </div>
        </div>
      </form>
    </ModalDialog>
  )
}
