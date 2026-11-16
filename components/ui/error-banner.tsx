import type { ReactNode } from 'react'

// "Error banner" from the Figma frames ACC-02b and ACC-09c: the soft red fill, a 1px danger border, 10px radius, 12px
// padding, an alert icon and the message in 15px medium danger red.
// `ink` is the larger banner of the Caregiver's Log task frame (VIS-07d): 14px padding and the message in 16px ink.
export function ErrorBanner({ children, testId, ink = false }: { children: ReactNode; testId?: string; ink?: boolean }) {
  return (
    <div role="alert" data-testid={testId} className={`flex w-full items-start gap-2 rounded-[10px] border border-figma-danger bg-figma-dangersoft ${ink ? 'p-[14px]' : 'p-3'}`}>
      <svg aria-hidden="true" className="shrink-0 text-figma-danger" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5l9.5 16.5h-19L12 3.5z" />
        <path d="M12 10v4.5M12 17.4v.1" />
      </svg>
      <p className={`min-w-0 flex-1 leading-[1.4] ${ink ? 'text-[16px] text-figma-ink' : 'text-[15px] font-medium text-figma-danger'}`}>{children}</p>
    </div>
  )
}
