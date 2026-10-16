import { test, expect } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, serviceClient } from './helpers'

// DEV-032: assign_booking / change_booking_caregiver through the real REST
// API, including two Admins acting on the same booking at once. The pgTAP file
// in backend-config covers each rule in depth.

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

async function newBooking() {
  const family = await createUserWithRole('family_member', 'Family Member')
  const recipientId = await apiAddRecipient(family.client, family.userId, 'Mzee Test')
  const { data, error } = await family.client
    .from('bookings')
    .insert({ account_id: family.userId, care_recipient_id: recipientId, bundle_code: 'medicheck', requested_datetime: tomorrow() })
    .select('id')
    .single()
  if (error || !data) throw new Error(`booking insert failed: ${error?.message}`)
  return { family, bookingId: data.id as string }
}

async function verifiedCaregiver(admin: Awaited<ReturnType<typeof createUserWithRole>>, name: string) {
  const caregiver = await createUserWithRole('caregiver', name)
  const { error } = await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
  if (error) throw new Error(`verify failed: ${error.message}`)
  return caregiver
}

async function bookingRow(id: string) {
  const { data } = await serviceClient()
    .from('bookings')
    .select('status, assigned_caregiver_id, assigned_by')
    .eq('id', id)
    .single()
  return data
}

async function assignmentRows(bookingId: string) {
  const { data } = await serviceClient()
    .from('booking_assignments')
    .select('caregiver_id, previous_caregiver_id, assigned_by')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
  return data
}

test.describe('DEV-032 — Booking assignment functions', () => {
  test('only an Admin can assign', async () => {
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const caregiver = await verifiedCaregiver(admin, 'Wanjiku Caregiver')
    const { family, bookingId } = await newBooking()
    const args = { p_booking_id: bookingId, p_caregiver_id: caregiver.userId }

    const asFamily = await family.client.rpc('assign_booking', args)
    expect(asFamily.error?.message).toBe('NOT_ADMIN')
    const asCaregiver = await caregiver.client.rpc('assign_booking', args)
    expect(asCaregiver.error?.message).toBe('NOT_ADMIN')

    expect(await bookingRow(bookingId)).toEqual({ status: 'requested', assigned_caregiver_id: null, assigned_by: null })
    expect(await assignmentRows(bookingId)).toEqual([])
  })

  test('assign, retry, then change the caregiver', async () => {
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const first = await verifiedCaregiver(admin, 'Kamau Caregiver')
    const second = await verifiedCaregiver(admin, 'Achieng Caregiver')
    const unverified = await createUserWithRole('caregiver', 'Unverified Caregiver')
    const { bookingId } = await newBooking()

    const refused = await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: unverified.userId })
    expect(refused.error?.message).toBe('CAREGIVER_NOT_VERIFIED')

    const assigned = await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: first.userId })
    expect(assigned.error).toBeNull()
    expect(typeof assigned.data).toBe('string')

    // a retry after a lost connection must not write a second assignment
    const retry = await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: first.userId })
    expect(retry.error?.message).toBe('BOOKING_NOT_REQUESTED')

    const sameAgain = await admin.client.rpc('change_booking_caregiver', { p_booking_id: bookingId, p_caregiver_id: first.userId })
    expect(sameAgain.error?.message).toBe('SAME_CAREGIVER')

    const changed = await admin.client.rpc('change_booking_caregiver', { p_booking_id: bookingId, p_caregiver_id: second.userId })
    expect(changed.error).toBeNull()

    expect(await bookingRow(bookingId)).toEqual({
      status: 'assigned',
      assigned_caregiver_id: second.userId,
      assigned_by: admin.userId,
    })
    expect(await assignmentRows(bookingId)).toEqual([
      { caregiver_id: first.userId, previous_caregiver_id: null, assigned_by: admin.userId },
      { caregiver_id: second.userId, previous_caregiver_id: first.userId, assigned_by: admin.userId },
    ])
  })

  test('a caregiver whose verification was removed cannot be assigned', async () => {
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const caregiver = await verifiedCaregiver(admin, 'Otieno Caregiver')
    const { bookingId } = await newBooking()

    const removed = await admin.client.rpc('remove_caregiver_verification', {
      p_caregiver_id: caregiver.userId,
      p_note: 'Reference failed',
    })
    expect(removed.error).toBeNull()

    const result = await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: caregiver.userId })
    expect(result.error?.message).toBe('CAREGIVER_NOT_VERIFIED')
    expect((await bookingRow(bookingId))?.status).toBe('requested')
  })

  test('two Admins assigning the same booking at once: exactly one wins', async () => {
    const adminA = await createUserWithRole('admin', 'Admin A')
    const adminB = await createUserWithRole('admin', 'Admin B')
    const caregiverA = await verifiedCaregiver(adminA, 'Caregiver A')
    const caregiverB = await verifiedCaregiver(adminA, 'Caregiver B')
    const { bookingId } = await newBooking()

    const [a, b] = await Promise.all([
      adminA.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: caregiverA.userId }),
      adminB.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: caregiverB.userId }),
    ])

    const outcomes = [a, b].map((r) => (r.error ? r.error.message : 'ok')).sort()
    expect(outcomes).toEqual(['BOOKING_NOT_REQUESTED', 'ok'])
    expect(await assignmentRows(bookingId)).toHaveLength(1)
  })
})
