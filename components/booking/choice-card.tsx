'use client'

import type { KeyboardEvent, ReactNode } from 'react'

// "Recipient option" and "Bundle card" from the Figma booking frames (ACC-06, ACC-07): a 14px-radius
// card with a 24px radio at the left. Unselected: white, 1px border in the border colour. Selected:
// the soft teal fill, a 3px primary border, the radio filled with a white check, and a "Selected"
// tag (check icon plus text) at the right, so selection is never colour alone. The card is the radio.
const check = (size: number) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export function ChoiceCard({
  selected,
  onSelect,
  testId,
  title,
  subtitle,
  titleClass = 'text-[18px] font-semibold',
  children,
}: {
  selected: boolean
  onSelect: () => void
  testId?: string
  title: string
  subtitle?: string
  titleClass?: string
  children?: ReactNode
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      data-testid={testId}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={[
        'flex w-full cursor-pointer flex-col gap-3 rounded-[14px] p-4 text-left text-figma-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2',
        selected ? 'border-[3px] border-figma-primary bg-figma-soft' : 'border border-figma-border bg-white',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={[
            'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
            selected ? 'border-figma-primary bg-figma-primary text-white' : 'border-figma-border bg-white',
          ].join(' ')}
        >
          {selected && check(14)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.4]">
          <h2 className={titleClass}>{title}</h2>
          {subtitle && <p className="text-[15px] text-figma-muted">{subtitle}</p>}
        </div>
        {selected && (
          <span className="flex shrink-0 items-center gap-1 text-[14px] font-medium leading-[1.4] text-figma-softtext">
            {check(16)}
            Selected
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
