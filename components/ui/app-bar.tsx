import Link from 'next/link'

// AppBar/Mobile from the Figma Components page: white, 56px high, 1px line
// border, a 44×44 back target with a 24px arrow, then the title in Inter
// semibold 18px. The title is plain text, not a heading: the screen's own h1
// stays in the page. The back target is a link (backHref) or, where going back
// needs a question first (Leave without finishing, ACC-11), a button (onBack).
const targetClass =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-figma-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary'

const arrow = (
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export function AppBar({
  title,
  backHref,
  onBack,
  backLabel,
  backTestId,
}: {
  title: string
  backLabel: string
  backHref?: string
  onBack?: () => void
  backTestId?: string
}) {
  return (
    <header className="flex h-14 items-center gap-1 border border-figma-line bg-white px-2">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label={backLabel} data-testid={backTestId} className={targetClass}>
          {arrow}
        </button>
      ) : (
        <Link href={backHref ?? '/'} aria-label={backLabel} data-testid={backTestId} className={targetClass}>
          {arrow}
        </Link>
      )}
      <p className="text-[18px] font-semibold leading-[1.4] text-figma-ink">{title}</p>
    </header>
  )
}
