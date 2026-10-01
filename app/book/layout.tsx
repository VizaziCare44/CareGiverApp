import { Suspense } from 'react'
import { BookingDraftProvider } from '@/lib/bookings/draft-context'

// Shared layout for the booking wizard (who → bundle → datetime → review →
// confirmation). Staying mounted across these steps is what lets
// BookingDraftProvider hold selections in memory without a URL or database
// round-trip — matches FD-ACC's "no persistence this Beta" scoping.
export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <BookingDraftProvider>{children}</BookingDraftProvider>
    </Suspense>
  )
}
