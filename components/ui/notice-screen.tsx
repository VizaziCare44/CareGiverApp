import type { ReactNode } from 'react'

// The outcome screens of the email links, in the pattern of ACC-10: a check in a 72px soft circle, the title in
// 24px bold, the sentence in 18px, both centred, then an optional text link. No app bar. Frames ACC-13b and ACC-16.
export function NoticeScreen({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center gap-4 bg-white p-5 text-figma-ink">
      <div className="flex size-[72px] items-center justify-center rounded-full bg-figma-soft text-figma-primary" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <h1 className="text-center text-[24px] font-bold leading-[1.25]">{title}</h1>
      <p className="text-center text-[18px] leading-[1.4]">{children}</p>
      {action}
    </main>
  )
}
