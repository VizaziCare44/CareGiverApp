import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <h1 className="text-2xl text-foreground">Link expired or invalid</h1>
      <p className="text-lg text-muted-foreground">
        This confirmation link didn&apos;t work. Try signing up again, or log in if you already confirmed.
      </p>
      <Link href="/log-in" className="w-full">
        <Button className="w-full">Go to log in</Button>
      </Link>
    </main>
  )
}
