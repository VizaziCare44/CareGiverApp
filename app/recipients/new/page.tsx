'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addCareRecipient } from './actions'

export default function AddCareRecipientPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [careNotes, setCareNotes] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const nameError = nameTouched && !name.trim() ? 'Name is required.' : undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameTouched(true)
    if (!name.trim() || submitting) return

    setSubmitting(true)
    setFormError(null)
    const result = await addCareRecipient({ name, careNotes })
    if (result.error) {
      setFormError(result.error)
      setSubmitting(false)
      return
    }
    router.push('/recipients')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl text-foreground">Add a care recipient</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          error={nameError}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="care-notes" className="text-base font-medium text-foreground">
            Care notes
          </label>
          {/* Trust/transparency microcopy per FD-ACC §6.5 — disclosed before
              the FM types anything sensitive. */}
          <p className="text-sm text-muted-foreground">
            Optional. Visible to Vizazi Care admin and to the caregiver assigned to this recipient&apos;s booking.
          </p>
          <textarea
            id="care-notes"
            rows={4}
            value={careNotes}
            onChange={(e) => setCareNotes(e.target.value)}
            className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-500"
          />
        </div>

        {formError && (
          <p role="alert" className="flex items-center gap-1.5 text-sm status-error">
            <span aria-hidden="true">⚠</span>
            {formError}
          </p>
        )}

        <Button type="submit" loading={submitting} loadingText="Saving…" className="w-full">
          Save
        </Button>
      </form>
    </main>
  )
}
