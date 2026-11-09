import type { ReactNode } from 'react'

// The body of an Admin screen in the Figma frames: 32 padding, 20 between the parts, up to the 1280 of the frame.
// Under 768 the padding is 16.
export function AdminMain({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto flex w-full max-w-[1280px] flex-col gap-5 p-4 text-figma-ink md:p-8 ${className}`}>{children}</main>
}
