import { ActionLink } from '@/components/ui/action-button'

// Frame ACC-15: a confirmation or reset link that did not work. The title and a sentence, then the primary
// button at the bottom.
export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-white p-5 text-figma-ink">
      <h1 className="text-[24px] font-bold leading-[1.25]">Link expired or invalid</h1>
      <p className="text-[16px] leading-[1.4] text-figma-muted">
        This confirmation link didn&apos;t work. Try signing up again, or log in if you already confirmed.
      </p>
      <div className="flex-1" />
      <ActionLink href="/log-in" className="w-full">
        Go to log in
      </ActionLink>
    </main>
  )
}
