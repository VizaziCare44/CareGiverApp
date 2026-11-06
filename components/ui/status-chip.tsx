// Pill/Verified, Chip/Check, Chip/Dash and Chip/Clock from the Figma Components
// page: a pill with an icon and a text label. Status is never colour alone (the
// icon and the word carry it), and the icon is decorative for screen readers
// because the label says it. Chip/Clock is amber (waiting), Chip/Check and
// Pill/Verified are soft green, Chip/Dash is a grey outline.

// The three outcomes of a task in a visit report (DEV-076): ONE neutral style, so no outcome is
// given a colour (no red, green or amber), told apart by the icon (a check or a dash) and the word.
const NEUTRAL = 'bg-figma-surface text-figma-ink border border-figma-border'

// One exception on the Admin's Exceptions screen (FD-ADMINEXC §7): the same neutral look, the label and the
// icon chosen by the caller (person, clock, hourglass, empty box, shield, page); nothing carries a colour.
const chips = {
  exception: { label: 'Exception', className: NEUTRAL, icon: 'dash' },
  done: { label: 'Done', className: NEUTRAL, icon: 'check' },
  'not-done': { label: 'Not done', className: NEUTRAL, icon: 'dash' },
  'not-recorded': { label: 'Not recorded', className: NEUTRAL, icon: 'dash' },
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
  // a visit that has started (Chip/Clock), the same on the Caregiver's and the family's screens
  'in-progress': {
    label: 'In progress',
    className: 'bg-figma-amber text-figma-ambertext',
    icon: 'clock',
  },
  // a visit that is finished (Chip/Check)
  completed: {
    label: 'Completed',
    className: 'bg-figma-soft text-figma-softtext',
    icon: 'check',
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
  person: (
    <>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" />
    </>
  ),
  hourglass: <path d="M4.5 2h7M4.5 14h7M5 2c0 3 3 4 3 6s-3 3-3 6M11 2c0 3-3 4-3 6s3 3 3 6" />,
  box: <path d="M2.5 4.5h11V13h-11zM2.5 4.5l1.5-2h8l1.5 2" />,
  shield: <path d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4z" />,
  page: <path d="M4 2h5l3 3v9H4zM9 2v3h3" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.5V8l2.25 1.5" />
    </>
  ),
} as const

// 14px is the size of every chip on every screen. The family's visit report (DEV-076, DECIDED 2026-10-16,
// §6.6(m)) reads at 16px or more, so it uses the `report` size of THIS component: the word at 16px in
// Medium weight with the 16px icon, 31px high, 10px padding left and right and 5px top and bottom, 6px
// between the icon and the word. The size takes no colour or tone: the fill, outline and dark text are
// the chip's own. Used only inside the report; the default is unchanged.
const sizes = {
  default: 'gap-1.5 py-[5px] pl-[10px] pr-3 text-[14px] leading-[1.4]',
  // 31px = 21 line + 2 x 4 padding + 2 x 1 outline, so the padding with the outline is 10px and 5px as drawn
  report: 'gap-1.5 px-[9px] py-[4px] text-[16px] leading-[21px]',
} as const

/** `label` replaces the default words when the same look carries a different message. */
export function StatusChip({
  status,
  label,
  size = 'default',
  icon,
}: {
  status: keyof typeof chips
  label?: string
  size?: keyof typeof sizes
  /** Replaces the chip's own icon (used by the Exceptions screen). */
  icon?: keyof typeof icons
}) {
  const chip = chips[status]
  const iconName = icon ?? chip.icon
  return (
    <span
      className={['inline-flex items-center rounded-full font-medium whitespace-nowrap', sizes[size], chip.className].join(' ')}
    >
      <svg
        aria-hidden="true"
        data-icon={iconName}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icons[iconName]}
      </svg>
      {label ?? chip.label}
    </span>
  )
}
