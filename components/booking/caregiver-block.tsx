import { StatusChip } from '@/components/ui/status-chip'
import { CAREGIVER_BLOCK_TEXT, type CaregiverBlockState } from '@/lib/bookings/caregiver-block'

// The caregiver block of the family's Booking Detail (DEV-045; frames VER-10 to VER-10d), in the four states
// of FD-VERIFY §6.1 Flow E: a surface-grey card, 14px radius, 16 padding, with a small label above. Only what the
// state allows is rendered: the name never reaches this component when the state must not show it, and no phone,
// email or photo is ever passed in. The status label of the booking is in the summary above, not repeated here.
const card = 'flex flex-col gap-[10px] rounded-[14px] bg-figma-surface p-4'
const label = 'text-[14px] font-semibold leading-[1.4] text-figma-muted'

const clock = (
  <svg aria-hidden="true" data-icon="clock" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-figma-ambertext">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 6.5V12l3.5 2" />
  </svg>
)

export function CaregiverBlock({ state, name }: { state: CaregiverBlockState; name: string | null }) {
  if (state === 'assigning') {
    return (
      <section aria-label="Caregiver" className={card}>
        <p className={label}>Caregiver</p>
        <p className="flex items-center gap-2 text-[18px] font-bold leading-[1.4]">
          {clock}
          {CAREGIVER_BLOCK_TEXT.assigningTitle}
        </p>
        <p className="text-[15px] leading-[1.4]">{CAREGIVER_BLOCK_TEXT.assigning}</p>
      </section>
    )
  }

  if (state === 'confirming') {
    // neither name, badge nor explanation: only the clock icon and the sentence
    return (
      <section aria-label="Caregiver" className={card}>
        <p className={label}>Caregiver</p>
        <p className="flex items-start gap-2 text-[18px] font-bold leading-[1.4]">
          {clock}
          {CAREGIVER_BLOCK_TEXT.confirming}
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="caregiver-heading" className={card}>
      <h2 id="caregiver-heading" className={label}>
        {CAREGIVER_BLOCK_TEXT.heading}
      </h2>
      <div className="flex flex-wrap items-center gap-[10px]">
        <p className="text-[20px] font-bold leading-[1.4]">{name}</p>
        {state === 'verified' && <StatusChip status="verified" />}
      </div>
      {state === 'verified' && <p className="text-[15px] leading-[1.4]">{CAREGIVER_BLOCK_TEXT.verifiedSentence}</p>}
    </section>
  )
}
