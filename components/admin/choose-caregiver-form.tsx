'use client'

import { useEffect, useState } from 'react'
import { ActionButton } from '@/components/ui/action-button'
import { RadioCard } from '@/components/ui/radio-field'
import { StatusChip } from '@/components/ui/status-chip'
import { AssignDialog } from '@/components/admin/assign-dialog'
import type { AssignMode } from '@/lib/admin/assign-dialog-text'

export interface CaregiverChoice {
  id: string
  name: string
  /** This booking's current caregiver: shown, but not selectable. */
  current: boolean
  /** Their other bookings that are assigned or under way, already formatted: information only. */
  otherBookings: string[]
}

/**
 * Single selection among the Verified caregivers (DEV-042). Their other bookings
 * are shown so the Admin can see how busy each is; nothing is marked or blocked.
 * Continue (DEV-043) opens the confirmation dialog for the chosen caregiver.
 */
export function ChooseCaregiverForm({
  bookingId,
  mode,
  recipient,
  previousCaregiver,
  caregivers,
}: {
  bookingId: string
  mode: AssignMode
  recipient: string
  /** Who has the booking now, for the Change dialog (null when none). */
  previousCaregiver: string | null
  caregivers: CaregiverChoice[]
}) {
  const [selected, setSelected] = useState<string | null>(null)
  // the choice as it was when Continue was pressed, so the dialog's text holds still:
  // the caregiver, and also whether this was an Assign or a Change and who had the
  // booking. After a conflict the page behind refreshes and the booking may now be
  // "assigned", which would otherwise turn "Assign caregiver" into "Change caregiver"
  // under the Admin.
  const [confirming, setConfirming] = useState<{ id: string; name: string; mode: AssignMode; previous: string | null } | null>(null)
  const [open, setOpen] = useState(false)

  // the screen refreshes behind the dialog: a choice that is no longer on offer is dropped
  useEffect(() => {
    if (selected && !caregivers.some((c) => c.id === selected && !c.current)) setSelected(null)
  }, [caregivers, selected])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const chosen = caregivers.find((c) => c.id === selected)
    if (!chosen) return
    setConfirming({ id: chosen.id, name: chosen.name, mode, previous: previousCaregiver })
    setOpen(true)
  }

  return (
    <>
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[18px] font-semibold">Verified caregivers</legend>
        {caregivers.map((caregiver) => (
          <RadioCard
            key={caregiver.id}
            name="caregiver"
            value={caregiver.id}
            disabled={caregiver.current}
            checked={selected === caregiver.id}
            onChange={() => setSelected(caregiver.id)}
          >
            <span className="flex flex-wrap items-center gap-3">
              <span className="text-[18px] font-semibold">{caregiver.name}</span>
              <StatusChip status="verified" />
              {caregiver.current && (
                <span className="rounded-full bg-sand-100 px-3 py-1 text-[14px] font-medium text-sand-800">Currently assigned</span>
              )}
            </span>
            {caregiver.otherBookings.length === 0 ? (
              <span className="text-[16px] text-figma-muted">No other bookings</span>
            ) : (
              <span className="flex flex-col gap-0.5">
                <span className="text-[14px] font-medium text-figma-muted">Other bookings</span>
                <ul className="flex flex-col gap-0.5 text-[16px]">
                  {caregiver.otherBookings.map((when, index) => (
                    <li key={index}>{when}</li>
                  ))}
                </ul>
              </span>
            )}
          </RadioCard>
        ))}
      </fieldset>

      <ActionButton type="submit" disabled={selected === null} className="self-start">
        Continue
      </ActionButton>
    </form>

    {/* outside the form: a dialog has a form of its own, and forms cannot nest */}
    <AssignDialog
        open={open}
        mode={confirming?.mode ?? mode}
        bookingId={bookingId}
        caregiver={confirming}
        previousCaregiver={confirming ? confirming.previous : previousCaregiver}
        recipient={recipient}
        onClose={() => setOpen(false)}
        onSelectionCleared={() => setSelected(null)}
      />
    </>
  )
}
