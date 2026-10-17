// Pill/Verified, Chip/Check, Chip/Dash and Chip/Clock from the Figma Components
// page: a pill with an icon and a text label. Status is never colour alone (the
// icon and the word carry it), and the icon is decorative for screen readers
// because the label says it. Chip/Clock is amber (waiting), Chip/Check and
// Pill/Verified are soft green, Chip/Dash is a grey outline.

const chips = {
  verified: {
    label: 'Verified',
    className: 'bg-figma-soft text-figma-softtext',
    icon: 'check',
  },
  'not-verified': {
    label: 'Not verified',
    className: 'bg-figma-surface text-figma-ink border border-figma-border',
    icon: 'dash',
  },
  // a booking that is waiting on someone (Chip/Clock)
  awaiting: {
    label: 'Awaiting caregiver assignment',
    className: 'bg-figma-amber text-figma-ambertext',
    icon: 'clock',
  },
  // a booking that has its caregiver (Chip/Check)
  assigned: {
    label: 'Caregiver assigned',
    className: 'bg-figma-soft text-figma-softtext',
    icon: 'check',
  },
} as const

const icons = {
  check: <path d="M3.5 8.5l3 3 6-7" />,
  dash: <path d="M3.5 8h9" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.5V8l2.25 1.5" />
    </>
  ),
} as const

/** `label` replaces the default words when the same look carries a different message. */
export function StatusChip({ status, label }: { status: keyof typeof chips; label?: string }) {
  const chip = chips[status]
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full py-[5px] pl-[10px] pr-3 text-[14px] font-medium leading-[1.4] whitespace-nowrap',
        chip.className,
      ].join(' ')}
    >
      <svg
        aria-hidden="true"
        data-icon={chip.icon}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icons[chip.icon]}
      </svg>
      {label ?? chip.label}
    </span>
  )
}
