import { bookingStatusLabel, type FamilyBookingStatus } from '@/lib/bookings/status-label'

// The status line on a family booking (DEV-044). The icon is decorative for
// screen readers because the words already say it; plain-text states have none.
export function BookingStatus({ status, caregiverVerified }: { status: FamilyBookingStatus; caregiverVerified: boolean | null }) {
  const { text, icon } = bookingStatusLabel(status, caregiverVerified)
  return (
    <span className="inline-flex items-center gap-2 text-[16px] font-semibold leading-[1.4] text-figma-ink">
      {icon && (
        <svg
          aria-hidden="true"
          data-icon={icon}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          {icon === 'clock' ? (
            <>
              <circle cx="10" cy="10" r="8" />
              <path d="M10 5.5V10l3 2" />
            </>
          ) : (
            <>
              <circle cx="10" cy="10" r="8" />
              <path d="M6.5 10.5l2.5 2.5 4.5-5.5" />
            </>
          )}
        </svg>
      )}
      {text}
    </span>
  )
}
