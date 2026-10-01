'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import { BUNDLE_LIST } from '@/lib/bookings/bundles'
import type { BundleCode } from '@/lib/bookings/types'
import { BookingStepHeader } from './booking-step-header'
import { Button } from '@/components/ui/button'

// FR-003 / FR-004 / AC-002 / BR-005. Exactly two cards, ever — Full Circle
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <BookingStepHeader title="Choose a care bundle" />
      <p className="-mt-4 text-base text-muted-foreground">Booking for {draft.recipientName}</p>

      <div className="flex flex-col gap-4" role="radiogroup" aria-label="Care bundle">
        {BUNDLE_LIST.map((bundle) => {
          const isSelected = selected === bundle.code
          return (
            <button
              key={bundle.code}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-testid={`bundle-card-${bundle.code}`}
              onClick={() => setSelected(bundle.code)}
              className={[
                'rounded-xl border-2 bg-surface p-5 text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-500',
                isSelected ? 'border-sage-600' : 'border-border',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl text-foreground">{bundle.name}</h2>
                {isSelected && (
                  <span aria-hidden="true" className="text-sage-600">
                    ✓
                  </span>
                )}
              </div>
              <p className="mt-1 text-base text-muted-foreground">
                {bundle.durationLabel} · {bundle.frequencyLabel}
              </p>

              <h3 className="mt-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Includes</h3>
              <ul className="mt-1 flex flex-col gap-1 text-base text-foreground">
                {bundle.inclusions.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>

              <h3 className="mt-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Response-time SLA</h3>
              <ul className="mt-1 flex flex-col gap-1 text-base text-foreground">
                {bundle.sla.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <Button disabled={!selected} onClick={handleContinue} className="w-full">
        Continue
      </Button>
    </main>
  )
}
