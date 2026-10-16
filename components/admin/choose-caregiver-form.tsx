'use client'

import { useState } from 'react'
import { ActionButton } from '@/components/ui/action-button'
import { RadioCard } from '@/components/ui/radio-field'
import { StatusChip } from '@/components/ui/status-chip'

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
 * The Continue button is in place but disabled: the confirmation dialogs that
 * assign the chosen caregiver are DEV-043.
 */
export function ChooseCaregiverForm({ caregivers }: { caregivers: CaregiverChoice[] }) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-5">
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

      <ActionButton type="submit" disabled className="self-start">
        Continue
      </ActionButton>
    </form>
  )
}
