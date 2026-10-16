'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionButton } from '@/components/ui/action-button'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { ModalDialog } from '@/components/ui/modal-dialog'
import { TextAreaField } from '@/components/ui/text-area-field'
import { verifyCaregiverAction } from '@/app/admin/actions'
import { useAdminAction } from '@/components/admin/use-admin-action'
import { missingForVerify, NOTE_MAX_LENGTH, VERIFY_DIALOG, verifyHint } from '@/lib/admin/verify-dialog-text'

/**
 * The action offered on the Caregiver Detail screen, by current status: "Mark as
 * Verified" (this task, DEV-038) or "Remove Verified" (disabled until DEV-039).
 * It stays mounted when the page refreshes, so the confirmation below survives
 * the status changing under it.
 */
export function CaregiverActions({ caregiverId, name, verified }: { caregiverId: string; name: string; verified: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const flashRef = useRef<HTMLParagraphElement>(null)

  // The opener is replaced when the status changes, so move focus to the confirmation.
  useEffect(() => {
    if (flash) flashRef.current?.focus()
  }, [flash])

  return (
    <div className="flex flex-col gap-3">
      {flash && (
        <p ref={flashRef} role="status" tabIndex={-1} className="text-[16px] font-medium text-figma-softtext outline-none">
          {flash}
        </p>
      )}

      {verified ? (
        <ActionButton variant="destructive" disabled className="self-start">
          Remove Verified
        </ActionButton>
      ) : (
        <ActionButton variant="primary" className="self-start" onClick={() => setOpen(true)}>
          {VERIFY_DIALOG.submit}
        </ActionButton>
      )}

      <MarkVerifiedDialog
        open={open}
        caregiverId={caregiverId}
        name={name}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false)
          setFlash(VERIFY_DIALOG.done(name))
          router.refresh()
        }}
      />
    </div>
  )
}

function MarkVerifiedDialog({
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
  const { run, pending, pendingText, error, clearError } = useAdminAction('verify')
  const [first, setFirst] = useState(false)
  const [second, setSecond] = useState(false)
  const [note, setNote] = useState('')

  // Each time the dialog opens it starts empty: the confirmations are made afresh.
  useEffect(() => {
    if (open) {
      setFirst(false)
      setSecond(false)
      setNote('')
      clearError()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const missing = missingForVerify({ first, second, note })
  const hint = verifyHint(missing)
  // after a "status changed" error the page behind has refreshed: saving again cannot succeed
  const stale = Boolean(error?.refresh)
  const canSubmit = missing.length === 0 && !pending && !stale

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    const result = await run(() => verifyCaregiverAction(caregiverId, note.trim()))
    if (result?.ok) onDone()
  }

  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="verify-dialog-title" locked={pending}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 id="verify-dialog-title" className="text-[22px] font-bold leading-[1.3]">
            {VERIFY_DIALOG.title(name)}
          </h2>
          <p className="text-[16px] leading-[1.4] text-figma-muted">{VERIFY_DIALOG.intro(name)}</p>
        </div>

        <fieldset className="flex flex-col">
          <legend className="sr-only">Confirm before marking {name} as Verified</legend>
          <CheckboxField checked={first} onChange={(e) => setFirst(e.target.checked)}>
            {VERIFY_DIALOG.confirmations[0](name)}
          </CheckboxField>
          <CheckboxField checked={second} onChange={(e) => setSecond(e.target.checked)}>
            {VERIFY_DIALOG.confirmations[1]()}
          </CheckboxField>
        </fieldset>

        <TextAreaField
          id="verify-note"
          label={VERIFY_DIALOG.noteLabel}
          helper={VERIFY_DIALOG.noteHelper}
          value={note}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(e) => setNote(e.target.value)}
          error={error?.field === 'note' ? error.message : null}
        />

        {error && error.field !== 'note' && (
          <p role="alert" className="flex items-start gap-1.5 text-[14px] leading-[1.4] text-figma-danger">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0">
              <circle cx="9" cy="9" r="7.5" />
              <path d="M9 5.2v4.6M9 12.4v.1" />
            </svg>
            {error.message}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {hint && !pending && !stale && (
            <p id="verify-hint" className="text-[14px] leading-[1.4] text-figma-muted">
              {hint}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <ActionButton variant="secondary" disabled={pending} onClick={onClose}>
              {stale ? VERIFY_DIALOG.close : VERIFY_DIALOG.cancel}
            </ActionButton>
            <ActionButton type="submit" disabled={!canSubmit} aria-describedby={hint ? 'verify-hint' : undefined}>
              {pending ? pendingText : VERIFY_DIALOG.submit}
            </ActionButton>
          </div>
        </div>
      </form>
    </ModalDialog>
  )
}
