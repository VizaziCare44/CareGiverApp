'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AppBar } from '@/components/ui/app-bar'
import { LeaveWithoutFinishingModal } from './leave-without-finishing-modal'

/**
 * The frame of the booking steps in the Figma frames ACC-06 to ACC-09: the AppBar "Book care" (56px, back
 * target 44×44), then a body with 20px padding and 16px between its parts, starting with the screen's title
 * (Inter bold 24px). The body grows to the screen's height, so a step can put a spacer before its button to
 * keep it at the bottom (ACC-06, ACC-09).
 *
 * From Bundle Selection onward Back asks "Leave without finishing?" first (AC-006): its presence here IS
 * "at Bundle Selection or a later step". Earlier steps (Who is this booking for?) pass confirmLeave={false}
 * and exit normally with no modal (TC-ACC-013 boundary).
 */
export function BookingScreen({
  heading,
  exitTo = '/recipients',
  confirmLeave = true,
  children,
}: {
  heading: string
  exitTo?: string
  confirmLeave?: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  // Not clearing the draft here: the provider lives in app/book/layout.tsx, so
  // leaving /book unmounts it and discards the draft. Clearing first made the
  // step's "no recipient" guard redirect back into the flow, racing the exit.
  function handleLeave() {
    setModalOpen(false)
    router.push(exitTo)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white text-figma-ink">
      {confirmLeave ? (
        <AppBar title="Book care" backLabel="Back" onBack={() => setModalOpen(true)} backTestId="booking-back" />
      ) : (
        <AppBar title="Book care" backLabel="Back" backHref={exitTo} backTestId="booking-back" />
      )}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <h1 className="text-[24px] font-bold leading-[1.25]">{heading}</h1>
        {children}
      </div>
      {confirmLeave && <LeaveWithoutFinishingModal open={modalOpen} onStay={() => setModalOpen(false)} onLeave={handleLeave} />}
    </main>
  )
}
