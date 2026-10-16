import { test, expect } from '@playwright/test'
import { apiAddRecipient, createUserWithRole } from './helpers'

// DEV-033: who can read what, through the real REST API. The pgTAP file in
// backend-config covers each rule in depth.

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

test.describe('DEV-033 — Caregiver and family reads', () => {
  test('a caregiver sees an assigned booking only while Verified', async () => {
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const caregiver = await createUserWithRole('caregiver', 'Kamau Caregiver')
    const family = await createUserWithRole('family_member', 'Mary Family')

    const recipientId = await apiAddRecipient(family.client, family.userId, 'Mzee Kimani')
    const careNotes = 'Takes insulin at 8am'
    await family.client.from('care_recipients').update({ care_notes: careNotes }).eq('id', recipientId)
    const { data: booking } = await family.client
      .from('bookings')
      .insert({ account_id: family.userId, care_recipient_id: recipientId, bundle_code: 'medicheck', requested_datetime: tomorrow() })
      .select('id')
      .single()

    const read = () =>
      caregiver.client.from('bookings').select('id, care_recipients(name, care_notes)')

    // not verified, not assigned: nothing
    expect((await read()).data).toEqual([])

    await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
    // verified but not assigned: still nothing
    expect((await read()).data).toEqual([])

    await admin.client.rpc('assign_booking', { p_booking_id: booking!.id, p_caregiver_id: caregiver.userId })
    expect((await read()).data).toEqual([
      { id: booking!.id, care_recipients: { name: 'Mzee Kimani', care_notes: careNotes } },
    ])

    // verification removed: booking and care notes disappear at once
    await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: caregiver.userId, p_note: 'Reference failed' })
    expect((await read()).data).toEqual([])
    const recipients = await caregiver.client.from('care_recipients').select('id')
    expect(recipients.data).toEqual([])

    // marked Verified again while still assigned: they come back
    await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Re-checked' })
    expect((await read()).data).toHaveLength(1)
  })

  test('profiles are read-only and private to their owner', async () => {
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const caregiver = await createUserWithRole('caregiver', 'Achieng Caregiver')
    const family = await createUserWithRole('family_member', 'Joseph Family')

    const familyProfiles = await family.client.from('profiles').select('id')
    expect(familyProfiles.data).toEqual([{ id: family.userId }])

    const caregiverProfiles = await caregiver.client.from('profiles').select('id')
    expect(caregiverProfiles.data).toEqual([{ id: caregiver.userId }])

    // no API write on profiles for anyone, an Admin included
    for (const who of [family, caregiver, admin]) {
      const { error } = await who.client.from('profiles').update({ full_name: 'Renamed' }).eq('id', who.userId)
      expect(error?.code).toBe('42501')
    }

    // only an Admin reads the verification history
    await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
    expect((await family.client.from('caregiver_verifications').select('id')).data).toEqual([])
    expect((await caregiver.client.from('caregiver_verifications').select('id')).data).toEqual([])
    const asAdmin = await admin.client.from('caregiver_verifications').select('caregiver_id, action').eq('caregiver_id', caregiver.userId)
    expect(asAdmin.data).toEqual([{ caregiver_id: caregiver.userId, action: 'verified' }])
  })
})
