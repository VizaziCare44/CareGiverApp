'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import { BUNDLE_LIST } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { ActionButton } from '@/components/ui/action-button'
import { BookingScreen } from './booking-screen'
import { ChoiceCard } from './choice-card'

// FR-003 / FR-004 / AC-002 / BR-005, frames ACC-07 and ACC-11. Exactly two cards, ever — Full Circle
// and Peace of Mind are not modeled in BUNDLE_LIST at all (not just hidden),
// and no price is rendered anywhere here (BR-005).
export function BundleSelect() {
  const router = useRouter()
  const draft = useBookingDraft()
  const [selected, setSelected] = useState<BundleCode | null>(draft.bundleCode)

  useEffect(() => {
    if (!draft.recipientId) router.replace('/book/who')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.recipientId])

  function handleContinue() {
    if (!selected) return
    draft.setBundle(selected)
    router.push('/book/datetime')
  }

  return (
    <BookingScreen heading="Choose a care bundle">
      <p className="text-[16px] leading-[1.4] text-figma-muted">Each booking covers one visit.</p>

      <div className="flex flex-col gap-4" role="radiogroup" aria-label="Care bundle">
        {BUNDLE_LIST.map((bundle) => (
          <ChoiceCard
            key={bundle.code}
            testId={`bundle-card-${bundle.code}`}
            title={bundle.name}
            subtitle={bundle.summary}
            titleClass="text-[20px] font-bold"
            selected={selected === bundle.code}
            onSelect={() => setSelected(bundle.code)}
          >
            <p className="text-[14px] font-semibold leading-[1.4]">What&apos;s included in the visit</p>
            <ul className="flex flex-col gap-3 text-[15px] leading-[1.4]">
              {bundle.inclusions.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
            <p className="text-[14px] font-semibold leading-[1.4]">Response times</p>
            <p className="text-[15px] leading-[1.4] text-figma-muted">{bundle.responseTimes}</p>
          </ChoiceCard>
        ))}
      </div>

      <ActionButton disabled={!selected} onClick={handleContinue} className="w-full">
        Continue
      </ActionButton>
    </BookingScreen>
  )
}
