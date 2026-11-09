import { ActionLink } from '@/components/ui/action-button'

// Logged-out landing screen. Authenticated visitors never see this —
// middleware.ts redirects them straight to their role's home. White, in Inter, with the Figma buttons
// (Button/Primary and Button/Secondary), like the screens it leads to.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 bg-white p-5 text-figma-ink">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-[72px] items-center justify-center rounded-full bg-figma-soft text-[32px]" aria-hidden="true">
          💚
        </div>
        <h1 className="text-[28px] font-bold leading-[1.25]">Vizazi Care</h1>
        <p className="text-[18px] leading-[1.4] text-figma-muted">Trusted, verified home care for your loved ones.</p>
      </div>

      <div className="flex flex-col gap-3">
        <ActionLink href="/sign-up" className="w-full">
          Create an account
        </ActionLink>
        <ActionLink href="/log-in" variant="secondary" className="w-full">
          Log in
        </ActionLink>
      </div>
    </main>
  )
}
