import Link from 'next/link'

// AppBar/Mobile from the Figma Components page: white, 56px high, 1px line
// border, a 44×44 back target with a 24px arrow, then the title in Inter
// semibold 18px. The title is plain text, not a heading: the screen's own h1
// stays in the page.
export function AppBar({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <header className="flex h-14 items-center gap-1 border border-figma-line bg-white px-2">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-figma-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary"
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <p className="text-[18px] font-semibold leading-[1.4] text-figma-ink">{title}</p>
    </header>
  )
}
