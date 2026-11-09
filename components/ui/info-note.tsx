import type { ReactNode } from 'react'

// "Note" and "Visibility microcopy" from the Figma frames (ACC-05, ACC-08): the surface fill, 10px radius, 12px
// padding, an info icon and the text in 14px ink.
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-2 rounded-[10px] bg-figma-surface p-3">
      <svg aria-hidden="true" className="shrink-0 text-figma-ink" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 11v6M12 7.2v.1" />
      </svg>
      <p className="min-w-0 flex-1 text-[14px] leading-[1.4] text-figma-ink">{children}</p>
    </div>
  )
}
