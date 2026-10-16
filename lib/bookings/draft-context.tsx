'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import type { BundleCode } from './types'

/**
 * In-memory-only booking draft state (FD-ACC §3.5 / §5.6): no persistent
 * saved drafts this Beta. State lives for as long as app/book/layout.tsx
 * stays mounted and is discarded on refresh, tab close, or "Leave" in the
 * leave-without-finishing modal — by design, not as a bug.
 */
interface BookingDraft {
  recipientId: string | null
  recipientName: string | null
  bundleCode: BundleCode | null
  date: string | null // yyyy-mm-dd
  time: string | null // HH:mm
  setRecipient: (id: string, name: string) => void
  setBundle: (code: BundleCode) => void
  setDateTime: (date: string, time: string) => void
  clear: () => void
  /** True from Bundle Selection onward (FR-008/AC-006) — the point at which
   * the leave-without-finishing warning must appear. */
  hasUnsavedSelections: boolean
}

const BookingDraftContext = createContext<BookingDraft | null>(null)

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  // Seeded from the entry link (/recipients "Book care for X") in the initial
  // state, not in an effect: a step's guard ("no recipient, go to /book/who")
  // runs in a child effect, which fires before a parent effect would have set
  // the recipient, so seeding later bounced every booking through /book/who.
  const [recipientId, setRecipientId] = useState<string | null>(() => searchParams.get('recipientId'))
  const [recipientName, setRecipientName] = useState<string | null>(() =>
    searchParams.get('recipientId') ? searchParams.get('recipientName') : null,
  )
  const [bundleCode, setBundleCode] = useState<BundleCode | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)

  const hasUnsavedSelections = Boolean(bundleCode)

  useEffect(() => {
    if (!hasUnsavedSelections) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedSelections])

  const value: BookingDraft = {
    recipientId,
    recipientName,
    bundleCode,
    date,
    time,
    setRecipient: (id, name) => {
      setRecipientId(id)
      setRecipientName(name)
    },
    setBundle: setBundleCode,
    setDateTime: (d, t) => {
      setDate(d)
      setTime(t)
    },
    clear: () => {
      setRecipientId(null)
      setRecipientName(null)
      setBundleCode(null)
      setDate(null)
      setTime(null)
    },
    hasUnsavedSelections,
  }

  return <BookingDraftContext.Provider value={value}>{children}</BookingDraftContext.Provider>
}

export function useBookingDraft() {
  const ctx = useContext(BookingDraftContext)
  if (!ctx) throw new Error('useBookingDraft must be used within BookingDraftProvider')
  return ctx
}
