import { Suspense } from 'react'
import { Inter } from 'next/font/google'
import { BookingDraftProvider } from '@/lib/bookings/draft-context'

// The Figma design language uses Inter; loaded for the booking screens built to it.
const inter = Inter({ subsets: ['latin'], display: 'swap' })

// Shared layout for the booking wizard (who → bundle → datetime → review →
// confirmation). Staying mounted across these steps is what lets
// BookingDraftProvider hold selections in memory without a URL or database
// round-trip — matches FD-ACC's "no persistence this Beta" scoping. The screens
// are white, as in the Figma frames (ACC-06 to ACC-11).
export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen bg-white ${inter.className}`}>
      <Suspense>
        <BookingDraftProvider>{children}</BookingDraftProvider>
      </Suspense>
    </div>
  )
}
