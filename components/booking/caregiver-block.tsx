import { StatusChip } from '@/components/ui/status-chip'
import { CAREGIVER_BLOCK_TEXT, type CaregiverBlockState } from '@/lib/bookings/caregiver-block'

// The caregiver block of the family's Booking Detail (DEV-045), in the four states
// of FD-VERIFY §6.1 Flow E. Only what the state allows is rendered: the name never
// reaches this component when the state must not show it, and no phone, email or
// photo is ever passed in. The status label of the booking is in the summary above,
// not repeated here.
export function CaregiverBlock({ state, name }: { state: CaregiverBlockState; name: string | null }) {
  const card = 'flex flex-col gap-3 rounded-xl border border-figma-line bg-white p-5'

  if (state === 'assigning') {
    return (
      <section aria-label="Caregiver" className={card}>
        <p className="text-[16px] leading-[1.4]">{CAREGIVER_BLOCK_TEXT.assigning}</p>
      </section>
    )
  }

  if (state === 'confirming') {
    // neither name, badge nor explanation: only the clock icon and the sentence
    return (
      <section aria-label="Caregiver" className={card}>
        <p className="flex items-start gap-2 text-[16px] leading-[1.4]">
          <svg aria-hidden="true" data-icon="clock" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 5.5V10l3 2" />
          </svg>
          {CAREGIVER_BLOCK_TEXT.confirming}
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="caregiver-heading" className={card}>
      <h2 id="caregiver-heading" className="text-[18px] font-semibold leading-[1.3]">
        {CAREGIVER_BLOCK_TEXT.heading}
      </h2>
      <p className="text-[18px] leading-[1.4]">{name}</p>
      {state === 'verified' && (
        <>
          <div className="flex">
            <StatusChip status="verified" />
          </div>
          <p className="text-[14px] leading-[1.4] text-figma-muted">{CAREGIVER_BLOCK_TEXT.verifiedSentence}</p>
        </>
      )}
    </section>
  )
}
