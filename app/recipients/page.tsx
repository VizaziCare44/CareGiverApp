import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { CareRecipient } from '@/lib/bookings/types'

// FR-002 / BR-003, screen inventory: Care Recipient List (incl. first-time
// empty state) — the entry point into the booking flow.
export default async function RecipientsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: recipients } = await supabase
    .from('care_recipients')
    .select('*')
    .eq('account_id', user!.id)
    .order('created_at', { ascending: true })

  const list = (recipients ?? []) as CareRecipient[]

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl text-foreground">Care recipients</h1>
        {/* DEV-046: the way into My Bookings; the only addition to this screen */}
        <Link href="/bookings" className="inline-flex h-12 items-center text-[16px] font-semibold text-figma-softtext underline">
          My bookings
        </Link>
      </div>

      {list.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg text-muted-foreground">Add your first care recipient to get started.</p>
          <Link href="/recipients/new" className="w-full">
            <Button className="w-full">Add your first care recipient</Button>
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((recipient) => (
            <Card key={recipient.id} className="flex items-center justify-between gap-4">
              <span className="text-lg font-medium text-foreground">{recipient.name}</span>
              <Link href={`/book/bundle?recipientId=${recipient.id}&recipientName=${encodeURIComponent(recipient.name)}`}>
                <Button variant="secondary">Book care for {recipient.name}</Button>
              </Link>
            </Card>
          ))}
          <Link href="/recipients/new">
            <Button variant="ghost" className="w-full">
              + Add another recipient
            </Button>
          </Link>
        </div>
      )}
    </main>
  )
}
