import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Logged-out landing screen. Authenticated visitors never see this —
// middleware.ts redirects them straight to their role's home.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-2xl" aria-hidden="true">
          💚
        </div>
        <h1 className="text-3xl text-sage-800">Vizazi Care</h1>
        <p className="text-lg text-muted-foreground">Trusted, verified home care for your loved ones.</p>
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/sign-up" className="w-full">
          <Button className="w-full">Create an account</Button>
        </Link>
        <Link href="/log-in" className="w-full">
          <Button variant="secondary" className="w-full">
            Log in
          </Button>
        </Link>
      </div>
    </main>
  )
}
