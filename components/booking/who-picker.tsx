'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import type { CareRecipient } from '@/lib/bookings/types'
import { ActionButton } from '@/components/ui/action-button'
import { BookingScreen } from './booking-screen'
import { ChoiceCard } from './choice-card'

// "Who is this booking for?", frame ACC-06 — shown only when 2+ recipients exist and none
// was pre-selected from the recipient list (FD-ACC §6.1). Exactly 1
// recipient: auto-selected, this screen is skipped entirely. Nobody is pre-selected
// (a wrong recipient is worse than one more tap); Continue waits for a choice.
export function WhoPicker({ recipients }: { recipients: CareRecipient[] }) {
  const router = useRouter()
  const draft = useBookingDraft()
  const [chosen, setChosen] = useState<CareRecipient | null>(null)

  useEffect(() => {
    if (draft.recipientId) {
      router.replace('/book/bundle')
      return
    }
    if (recipients.length === 1) {
      draft.setRecipient(recipients[0].id, recipients[0].name)
      router.replace('/book/bundle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.recipientId, recipients.length])

  if (draft.recipientId || recipients.length <= 1) return null

  function handleContinue() {
    if (!chosen) return
    draft.setRecipient(chosen.id, chosen.name)
    router.push('/book/bundle')
  }

  return (
    <BookingScreen heading="Who is this booking for?" confirmLeave={false}>
      <div className="flex flex-col gap-4" role="radiogroup" aria-label="Care recipient">
        {recipients.map((r) => (
          <ChoiceCard key={r.id} testId={`who-option-${r.id}`} title={r.name} selected={chosen?.id === r.id} onSelect={() => setChosen(r)} />
        ))}
      </div>
      <div className="flex-1" />
      <ActionButton disabled={!chosen} onClick={handleContinue} className="w-full">
        Continue
      </ActionButton>
    </BookingScreen>
  )
}
