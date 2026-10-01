'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import { BUNDLES } from '@/lib/bookings/bundles'
import { BookingStepHeader } from './booking-step-header'
import { Button } from '@/components/ui/button'

// FR-005. Copy deliberately avoids "reserved"/"held" language — no
// slot-locking exists (FD-ACC §7.7), so a selection here is not a guarantee.
export function DateTimeSelect() {
  const router = useRouter()
  const draft = useBookingDraft()
  const [date, setDate] = useState(draft.date ?? '')
  const [time, setTime] = useState(draft.time ?? '')

  useEffect(() => {
    if (!draft.bundleCode) router.replace('/book/bundle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.bundleCode])

  if (!draft.bundleCode) return null
  const bundle = BUNDLES[draft.bundleCode]

  function handleContinue() {
    if (!date || !time) return
    draft.setDateTime(date, time)
    router.push('/book/review')
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <BookingStepHeader title={bundle.dateTimeCopy} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="visit-date" className="text-base font-medium text-foreground">
            Date
          </label>
          <input
            id="visit-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-touch rounded-lg border border-border bg-surface px-4 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="visit-time" className="text-base font-medium text-foreground">
            Time
          </label>
          <input
            id="visit-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="min-h-touch rounded-lg border border-border bg-surface px-4 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-500"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          This isn&apos;t a confirmed or held slot yet — we&apos;ll confirm your caregiver after you submit.
        </p>
      </div>

      <Button disabled={!date || !time} onClick={handleContinue} className="w-full">
        Continue
      </Button>
    </main>
  )
}
