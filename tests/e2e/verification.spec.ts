import { test, expect } from '@playwright/test'
import { anonClient, randomEmail, serviceClient, TEST_PASSWORD } from './helpers'

// DEV-031: verify_caregiver / remove_caregiver_verification through the real
// REST API. The pgTAP file in backend-config covers the rules in depth; this
// proves the functions are reachable (and refused) the way the app will call them.

async function createUserWithRole(role: 'admin' | 'caregiver' | 'family_member', fullName: string) {
  const email = randomEmail()
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: '+254700000030' },
    ...(role === 'family_member' ? {} : { app_metadata: { role } }),
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)

  const client = anonClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`)
  return { userId: data.user.id, client }
}

test.describe('DEV-031 — Caregiver verification functions', () => {
  test('only an Admin can call them', async () => {
    const caregiver = await createUserWithRole('caregiver', 'Wanjiku Caregiver')
    const family = await createUserWithRole('family_member', 'Peter Family')
    const args = { p_caregiver_id: caregiver.userId, p_note: 'Met in person' }

    const asFamily = await family.client.rpc('verify_caregiver', args)
    expect(asFamily.error?.message).toBe('NOT_ADMIN')

    const asCaregiver = await caregiver.client.rpc('verify_caregiver', args)
    expect(asCaregiver.error?.message).toBe('NOT_ADMIN')

    const signedOut = await anonClient().rpc('verify_caregiver', args)
    expect(signedOut.error?.code).toBe('42501')

    const { data } = await serviceClient().from('caregiver_verifications').select('id').eq('caregiver_id', caregiver.userId)
    expect(data).toEqual([])
  })

  test('an Admin verifies and removes, one history row per call', async () => {
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const caregiver = await createUserWithRole('caregiver', 'Kamau Caregiver')
    const base = { p_caregiver_id: caregiver.userId }

    const noNote = await admin.client.rpc('verify_caregiver', { ...base, p_note: '  ' })
    expect(noNote.error?.message).toBe('NOTE_REQUIRED')

    const verified = await admin.client.rpc('verify_caregiver', { ...base, p_note: 'Met in person, references checked' })
    expect(verified.error).toBeNull()
    expect(typeof verified.data).toBe('string')

    const again = await admin.client.rpc('verify_caregiver', { ...base, p_note: 'retry' })
    expect(again.error?.message).toBe('ALREADY_VERIFIED')

    const removed = await admin.client.rpc('remove_caregiver_verification', { ...base, p_note: 'Reference failed' })
    expect(removed.error).toBeNull()

    const removedAgain = await admin.client.rpc('remove_caregiver_verification', { ...base, p_note: 'retry' })
    expect(removedAgain.error?.message).toBe('NOT_VERIFIED')

    const { data } = await serviceClient()
      .from('caregiver_verifications')
      .select('action, note, acted_by')
      .eq('caregiver_id', caregiver.userId)
      .order('created_at', { ascending: true })
    expect(data).toEqual([
      { action: 'verified', note: 'Met in person, references checked', acted_by: admin.userId },
      { action: 'removed', note: 'Reference failed', acted_by: admin.userId },
    ])
  })

  test('only caregivers can be verified', async () => {
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const family = await createUserWithRole('family_member', 'Jane Family')

    const result = await admin.client.rpc('verify_caregiver', { p_caregiver_id: family.userId, p_note: 'should fail' })
    expect(result.error?.message).toBe('CAREGIVER_NOT_FOUND')
  })
})
