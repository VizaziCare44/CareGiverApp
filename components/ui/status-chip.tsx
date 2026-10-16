// Chip/Check and Chip/Dash from the Figma Components page: a pill with an icon
// and a text label. Status is never colour alone (the icon and the word carry
// it), and the icon is decorative for screen readers because the label says it.

const chips = {
  verified: {
    label: 'Verified',
    className: 'bg-figma-soft text-figma-softtext',
    icon: <path d="M3.5 8.5l3 3 6-7" />,
  },
  'not-verified': {
    label: 'Not verified',
    className: 'bg-figma-surface text-figma-ink border border-figma-border',
    icon: <path d="M3.5 8h9" />,
  },
} as const

export function StatusChip({ status }: { status: keyof typeof chips }) {
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
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {chip.icon}
      </svg>
      {chip.label}
    </span>
  )
}
