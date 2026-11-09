'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
 * Single selection among the Verified caregivers (DEV-042; frames VER-07, 07c). Their other bookings
 * are shown so the Admin can see how busy each is; nothing is marked or blocked.
 * "Assign {name}" or "Change to {name}" (DEV-043) opens the confirmation dialog for the chosen caregiver.
 */
export function ChooseCaregiverForm({
  bookingId,
  mode,
  recipient,
  summary,
  previousCaregiver,
  caregivers,
  notShown,
}: {
  bookingId: string
  mode: AssignMode
  recipient: string
  /** "Grace Wanjiru · MediCheck · Wed 14 Oct 2026, 09:00 EAT", the line the dialog repeats. */
  summary: string
  /** Who has the booking now, for the Change dialog (null when none). */
  previousCaregiver: string | null
  caregivers: CaregiverChoice[]
  /** How many caregivers are left out because they are not Verified. */
  notShown: number
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  // the choice as it was when the button was pressed, so the dialog's text holds still:
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

  const chosen = caregivers.find((c) => c.id === selected)
  const label = chosen ? (mode === 'change' ? `Change to ${chosen.name}` : `Assign ${chosen.name}`) : mode === 'change' ? 'Change caregiver' : 'Assign caregiver'

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!chosen) return
    setConfirming({ id: chosen.id, name: chosen.name, mode, previous: previousCaregiver })
    setOpen(true)
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-5">
          <legend className="sr-only">Verified caregivers</legend>
          {caregivers.map((caregiver) => (
            <RadioCard
              key={caregiver.id}
              name="caregiver"
              value={caregiver.id}
              disabled={caregiver.current}
              checked={selected === caregiver.id}
              onChange={() => setSelected(caregiver.id)}
            >
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-[18px] font-bold leading-[1.4]">{caregiver.name}</span>
                <StatusChip status="verified" />
                {caregiver.current && (
                  <span className="flex items-center gap-1 text-[14px] font-semibold leading-[1.4]">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.5 8.5l3 3 6-7" />
                    </svg>
                    Currently assigned
                  </span>
                )}
              </span>
              <span className="text-[13px] font-semibold leading-[1.4] text-figma-muted">Other assigned bookings (for information; nothing is blocked)</span>
              {caregiver.otherBookings.length === 0 ? (
                <span className="text-[15px] leading-[1.4]">No other bookings</span>
              ) : (
                <ul className="flex flex-col gap-2 text-[15px] leading-[1.4]">
                  {caregiver.otherBookings.map((when, index) => (
                    <li key={index}>{when}</li>
                  ))}
                </ul>
              )}
            </RadioCard>
          ))}
        </fieldset>

        {notShown > 0 && (
          <p className="flex items-center gap-2 text-[14px] leading-[1.4] text-figma-muted">
            <svg aria-hidden="true" className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 11v6M12 7.2v.1" />
            </svg>
            {notShown === 1 ? '1 caregiver is' : `${notShown} caregivers are`} not shown because they are Not verified.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <ActionButton variant="secondary" className="w-[140px]" onClick={() => router.push(`/admin/bookings/${bookingId}`)}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" disabled={chosen === undefined} className="min-w-[280px]">
            {label}
          </ActionButton>
        </div>
      </form>

      {/* outside the form: a dialog has a form of its own, and forms cannot nest */}
      <AssignDialog
        open={open}
        mode={confirming?.mode ?? mode}
        bookingId={bookingId}
        caregiver={confirming}
        previousCaregiver={confirming ? confirming.previous : previousCaregiver}
        recipient={recipient}
        summary={summary}
        onClose={() => setOpen(false)}
        onSelectionCleared={() => setSelected(null)}
      />
    </>
  )
}
