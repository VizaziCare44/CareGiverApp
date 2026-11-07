import Link from 'next/link'
import type { ReactNode } from 'react'

// "Booking summary" from the Figma frames ACC-09 and ACC-10: a 14px-radius card with a 1px border, three
// rows (label 13px muted over the value 16px semibold) divided by 1px lines. On the review screen each row
// ends in an "Edit" link (primary, semibold, underlined, a 56×44 target) named "Edit care recipient" and so on.
export interface SummaryRow {
  label: string
  value: ReactNode
  edit?: { href: string; label: string }
}

export function BookingSummary({ rows }: { rows: SummaryRow[] }) {
  return (
    <div className="flex w-full flex-col rounded-[14px] border border-figma-border bg-white px-4 py-1" data-testid="booking-summary">
      {rows.map((row, index) => (
        <div key={row.label} className={['flex items-center gap-2 py-2', index > 0 ? 'border-t border-figma-line' : ''].join(' ')}>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[1.4]">
            <p className="text-[13px] text-figma-muted">{row.label}</p>
            <p className="text-[16px] font-semibold text-figma-ink">{row.value}</p>
          </div>
          {row.edit && (
            <Link
              href={row.edit.href}
              aria-label={row.edit.label}
              className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg text-[16px] font-semibold leading-[1.4] text-figma-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary"
            >
              Edit
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
