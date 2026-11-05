'use client'

import { useRef, useState } from 'react'
import { ActionButton } from '@/components/ui/action-button'
import { AlertMessage } from '@/components/ui/alert-message'
import { VisitReport } from '@/components/booking/visit-report'
import { Notice } from '@/components/caregiver/notice'
import { ContactAddressRow } from '@/components/caregiver/missing-booking-help'
import { reloadVisitAction } from '@/app/bookings/[id]/actions'
import { formatDateTime } from '@/lib/datetime'
import type { FamilyBookingStatus } from '@/lib/bookings/status-label'
import type { BundleCode } from '@/lib/bookings/types'
import { familyVisitState, type VisitReads } from '@/lib/visits/family-visit'
import { FAMILY_VISIT } from '@/lib/visits/family-visit-text'

const card = 'flex flex-col gap-4 rounded-xl border border-figma-line bg-white p-5'

/**
 * The visit block of the family's Booking Detail, under the caregiver block (DEV-075; frames FAM-02,
 * FAM-07). Which state it is in is decided by familyVisitState from what the page read:
 *   F2  in progress: "Visit", "Checked in at" with the time on the next line, and the fixed line. No
 *       task, outcome, reason or note, whatever came back.
 *   F4  completed with no visit at all: the notice and the address row.
 *   F5  a read failed, or the visit is not in a state a report can be made from: the message and a
 *       Try again button, in place of the visit block only.
 *   F3  completed and closed, with its tasks: the report (DEV-076, VisitReport).
 *   F1, F6: nothing here.
 * It starts no request of its own: no polling, no timer, no realtime, no cached copy. The page is read
 * again when it is opened, gone back to or reloaded; Try again repeats only the visit reads.
 */
export function FamilyVisitBlock({ bookingId, bundleCode, status: initialStatus, reads: initialReads }: { bookingId: string; bundleCode: BundleCode; status: FamilyBookingStatus; reads: VisitReads }) {
  const busy = useRef(false)
  const [status, setStatus] = useState(initialStatus)
  const [reads, setReads] = useState(initialReads)
  const [pending, setPending] = useState(false)

  const state = familyVisitState(status, reads)

  async function tryAgain() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    try {
      const result = await reloadVisitAction(bookingId)
      if (result.ok) {
        setStatus(result.status)
        setReads(result.reads)
      } else {
        setReads({ ok: false, visit: null, tasks: [] })
      }
    } catch {
      // the request never completed: the same message, and the button is there again
      setReads({ ok: false, visit: null, tasks: [] })
    }
    busy.current = false
    setPending(false)
  }

  if (state === 'in-progress' && reads.visit) {
    return (
      <section aria-labelledby="visit-heading" className={card} data-testid="visit-block">
        <h2 id="visit-heading" className="text-[18px] font-semibold leading-[1.3]">
          {FAMILY_VISIT.heading}
        </h2>
        <div>
          <p className="text-[14px] font-medium text-figma-muted">{FAMILY_VISIT.checkedInAt}</p>
          <p className="text-[16px]" data-testid="visit-checked-in">
            {formatDateTime(reads.visit.checked_in_at)}
          </p>
        </div>
        <p className="text-[16px] leading-[1.4]">{FAMILY_VISIT.inProgressLine}</p>
      </section>
    )
  }

  if (state === 'not-available') {
    return (
      <section aria-label={FAMILY_VISIT.heading} data-testid="visit-block">
        <Notice>
          <p>{FAMILY_VISIT.notAvailable}</p>
          <ContactAddressRow />
        </Notice>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="visit-heading" className={card} data-testid="visit-block">
        <h2 id="visit-heading" className="text-[18px] font-semibold leading-[1.3]">
          {FAMILY_VISIT.heading}
        </h2>
        <AlertMessage>{FAMILY_VISIT.loadError}</AlertMessage>
        <ActionButton variant="secondary" className="self-start" disabled={pending} onClick={tryAgain}>
          {pending ? FAMILY_VISIT.trying : FAMILY_VISIT.tryAgain}
        </ActionButton>
      </section>
    )
  }

  if (state === 'report' && reads.visit) return <VisitReport bundle={bundleCode} visit={reads.visit} tasks={reads.tasks} />

  // 'none' (F1, F6): no visit block
  return null
}
