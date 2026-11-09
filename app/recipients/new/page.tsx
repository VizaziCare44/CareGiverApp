'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionButton } from '@/components/ui/action-button'
import { AppBar } from '@/components/ui/app-bar'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Field } from '@/components/ui/field'
import { InfoNote } from '@/components/ui/info-note'
import { TextAreaField } from '@/components/ui/text-area-field'
import { addCareRecipient } from './actions'

// FR-002 / AC-004 / BR-004, frame ACC-05: the AppBar "Add care recipient" (its back target returns to the list),
// "Full name (required)", "Care notes (optional)", the note saying who can see care notes (disclosed before the
// Family Member types anything sensitive, FD-ACC §6.5), and "Save recipient" at the bottom.
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white text-figma-ink">
      <AppBar title="Add care recipient" backHref="/recipients" backLabel="Back" />
      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4 p-5">
        <h1 className="sr-only">Add care recipient</h1>

        {formError && <ErrorBanner>{formError}</ErrorBanner>}

        <Field
          label="Full name (required)"
          placeholder="Full name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          error={nameError}
        />
        <TextAreaField
          id="care-notes"
          label="Care notes (optional)"
          placeholder="Anything the caregiver should know"
          value={careNotes}
          onChange={(e) => setCareNotes(e.target.value)}
        />
        <InfoNote>Care notes are visible to Vizazi Care Admin and to the caregiver assigned to this person&apos;s booking.</InfoNote>

        <div className="flex-1" />
        <ActionButton type="submit" disabled={submitting} aria-busy={submitting || undefined} className="w-full">
          {submitting ? 'Saving…' : 'Save recipient'}
        </ActionButton>
      </form>
    </main>
  )
}
