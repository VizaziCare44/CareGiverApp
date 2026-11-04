import type { ReactNode } from 'react'

/**
 * The notice that sits directly under the booking summary on Assignment Detail
 * (frames VIS-02, VIS-05, VIS-05b): a circled "i" and the words, so it never relies on
 * colour. It is a note, not an alert: nothing here is an error.
 */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="note" data-testid="visit-notice" className="flex gap-3 rounded-xl border border-figma-border bg-figma-surface p-4 text-[14px] leading-[1.4] text-figma-ink">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 shrink-0">
        <circle cx="10" cy="10" r="8.5" />
        <path d="M10 9v5M10 6v.1" />
      </svg>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
