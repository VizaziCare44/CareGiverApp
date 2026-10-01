'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import type { CareRecipient } from '@/lib/bookings/types'

// "Who is this booking for?" — shown only when 2+ recipients exist and none
// was pre-selected from the recipient list (FD-ACC §6.1). Exactly 1
// recipient: auto-selected, this screen is skipped entirely.
export function WhoPicker({ recipients }: { recipients: CareRecipient[] }) {
  const router = useRouter()
  const draft = useBookingDraft()

  useEffect(() => {
    if (draft.recipientId) {
      router.replace('/book/bundle')
      return
    }
    if (recipients.length === 1) {
      draft.setRecipient(recipients[0].id, recipients[0].name)
      router.replace('/book/bundle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.recipientId, recipients.length])

  if (draft.recipientId || recipients.length <= 1) return null

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl text-foreground">Who is this booking for?</h1>
      <div className="flex flex-col gap-3">
        {recipients.map((r) => (
          <button
            key={r.id}
            type="button"
            data-testid={`who-option-${r.id}`}
            onClick={() => {
              draft.setRecipient(r.id, r.name)
              router.push('/book/bundle')
            }}
            className="min-h-touch rounded-lg border border-border bg-surface px-4 text-left text-lg font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-500"
          >
            {r.name}
          </button>
        ))}
      </div>
    </main>
  )
}
