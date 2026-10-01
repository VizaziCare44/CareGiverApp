'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// FR-002 / AC-004 / BR-004: name required, care_notes optional. Server-side
// check is the belt to the client's inline validation — the real
// enforcement is the NOT NULL constraint in supabase/migrations/0001_init.sql.
export async function addCareRecipient({ name, careNotes }: { name: string; careNotes: string }): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Name is required.' }

  const { error } = await supabase.from('care_recipients').insert({
    account_id: user.id,
    name: trimmedName,
    care_notes: careNotes.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/recipients')
  return {}
}
