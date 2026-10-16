import type { ReactNode } from 'react'

// The error line from Field/Error in the Figma Components page: an alert icon and
// the message in the danger colour, announced to screen readers when it appears.
export function AlertMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[14px] leading-[1.4] text-figma-danger">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0">
        <circle cx="9" cy="9" r="7.5" />
        <path d="M9 5.2v4.6M9 12.4v.1" />
      </svg>
      {children}
    </p>
  )
}
