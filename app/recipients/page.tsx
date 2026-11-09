import { createClient } from '@/lib/supabase/server'
import { ActionLink } from '@/components/ui/action-button'
import { TextLink } from '@/components/ui/text-link'
import type { CareRecipient } from '@/lib/bookings/types'

// FR-002 / BR-003, frames ACC-03 (first-time empty state) and ACC-04: the Care Recipient List — the entry point
// into the booking flow. The header is the title with "My bookings" (DEV-046, FR-017) at the right; the empty
// state is a surface card with the invitation and the primary button; each recipient is a bordered card with
// their name and a "Book care for {first name}" button; "Add another recipient" closes the list as the outlined
// button.
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-white p-5 text-figma-ink">
      <div className="flex items-center">
        <h1 className="min-w-0 flex-1 text-[24px] font-bold leading-[1.25]">Care recipients</h1>
        <TextLink href="/bookings" className="px-1">
          My bookings
        </TextLink>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-figma-line bg-figma-surface p-5" data-testid="recipients-empty">
          <p className="text-[18px] font-semibold leading-[1.4]">No care recipients yet</p>
          <p className="text-[15px] leading-[1.4] text-figma-muted">Add the person you are arranging care for to start a booking.</p>
          <ActionLink href="/recipients/new" className="w-full">
            Add your first care recipient
          </ActionLink>
        </div>
      ) : (
        <>
          {list.map((recipient) => (
            <div key={recipient.id} className="flex flex-col gap-3 rounded-[14px] border border-figma-border bg-white p-4" data-testid="recipient-card">
              <p className="text-[18px] font-semibold leading-[1.4]">{recipient.name}</p>
              <ActionLink
                href={`/book/bundle?recipientId=${recipient.id}&recipientName=${encodeURIComponent(recipient.name)}`}
                aria-label={`Book care for ${recipient.name}`}
                className="w-full"
              >
                Book care for {recipient.name.trim().split(/\s+/)[0]}
              </ActionLink>
            </div>
          ))}
          <ActionLink href="/recipients/new" variant="secondary" className="w-full">
            Add another recipient
          </ActionLink>
        </>
      )}
    </main>
  )
}
