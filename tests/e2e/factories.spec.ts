import { test, expect } from '@playwright/test'
import { formatDate, formatDateTime } from '../../lib/datetime'
import { logInViaUI, serviceClient } from './helpers'
import {
  NAIROBI_OFFSET_HOURS,
  TEST_EMAIL_DOMAIN,
  makeAdmin,
  makeBooking,
  makeCaregiver,
  makeFamily,
  makeRecipient,
  nairobiTime,
  type BookingStatus,
} from './factories'

// DEV-051 (with the base form of DEV-055): the factories behave as their tickets
// say, checked against what the real database functions do, so a test built on a
// factory is built on data the app could really have.

const TAG_EMAIL = new RegExp(`^e2e-[a-z0-9]+@${TEST_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`)

test.describe('factories — accounts', () => {
  test('every account carries a unique e2e tag address and comes with a working session', async () => {
    const [family, caregiver, admin, again] = await Promise.all([makeFamily(), makeCaregiver(), makeAdmin(), makeFamily()])
    for (const user of [family, caregiver, admin, again]) expect(user.email).toMatch(TAG_EMAIL)
    expect(new Set([family.email, caregiver.email, admin.email, again.email]).size).toBe(4)

    // the session is real: each reads its own profile, and the role is the one asked for
    for (const [user, role] of [[family, 'family_member'], [caregiver, 'caregiver'], [admin, 'admin']] as const) {
      const profile = await user.client.from('profiles').select('role').eq('id', user.userId).single()
      expect(profile.data?.role).toBe(role)
    }
  })
})

test.describe('factories — makeCaregiver({ verified })', () => {
  test('true is one verified row, false is none, "removed" is verified then removed, written in order', async () => {
    const admin = await makeAdmin()
    const [yes, no, removed] = await Promise.all([makeCaregiver({ verified: true }), makeCaregiver(), makeCaregiver({ verified: 'removed' })])

    const rowsOf = async (id: string) =>
      (await serviceClient().from('caregiver_verifications').select('action, created_at').eq('caregiver_id', id).order('created_at', { ascending: true })).data ?? []

    expect((await rowsOf(yes.userId)).map((r) => r.action)).toEqual(['verified'])
    expect(await rowsOf(no.userId)).toEqual([])
    const history = await rowsOf(removed.userId)
    expect(history.map((r) => r.action)).toEqual(['verified', 'removed'])
    expect(new Date(history[1].created_at).getTime()).toBeGreaterThan(new Date(history[0].created_at).getTime())
    // what the factory returns is what was written
    expect(removed.history.map((r) => r.action)).toEqual(['verified', 'removed'])

    // and the database agrees about who is Verified now (the Admin's own view of it)
    const overview = await admin.client.from('caregiver_overview').select('id, verified').in('id', [yes.userId, no.userId, removed.userId])
    const byId = Object.fromEntries((overview.data ?? []).map((row) => [row.id, row.verified]))
    expect(byId).toEqual({ [yes.userId]: true, [no.userId]: false, [removed.userId]: false })
  })
})

test.describe('factories — makeBooking', () => {
  const STATUSES: BookingStatus[] = ['requested', 'assigned', 'in_progress', 'completed', 'cancelled']

  for (const status of STATUSES) {
    test(`${status}: written as the status/caregiver rule and assign_booking would leave it`, async () => {
      const family = await makeFamily()
      const caregiver = await makeCaregiver({ verified: true })
      const withCaregiver = status !== 'requested'
      const booking = await makeBooking({ family, status, caregiver: withCaregiver ? caregiver : undefined, bundle: 'doctors_day_out' })

      const row = await serviceClient().from('bookings').select('status, bundle_code, assigned_caregiver_id, assigned_by, assigned_at, account_id').eq('id', booking.id).single()
      expect(row.error).toBeNull()
      expect(row.data).toMatchObject({ status, bundle_code: 'doctors_day_out', account_id: family.userId })
      const assignments = (await serviceClient().from('booking_assignments').select('caregiver_id, previous_caregiver_id, assigned_by').eq('booking_id', booking.id)).data ?? []

      if (withCaregiver) {
        expect(row.data!.assigned_caregiver_id).toBe(caregiver.userId)
        expect(row.data!.assigned_by).not.toBeNull()
        expect(row.data!.assigned_at).not.toBeNull()
        expect(assignments).toEqual([{ caregiver_id: caregiver.userId, previous_caregiver_id: null, assigned_by: row.data!.assigned_by }])
      } else {
        expect(row.data).toMatchObject({ assigned_caregiver_id: null, assigned_by: null, assigned_at: null })
        expect(assignments).toEqual([])
      }
    })
  }

  test('a cancelled booking can also have no caregiver; the rule is refused clearly, and the database refuses it too', async () => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })

    const bare = await makeBooking({ family, status: 'cancelled' })
    expect(bare.caregiverId).toBeNull()

    await expect(makeBooking({ family, status: 'assigned' })).rejects.toThrow(/needs a caregiver/)
    await expect(makeBooking({ family, status: 'in_progress' })).rejects.toThrow(/needs a caregiver/)
    await expect(makeBooking({ family, status: 'completed' })).rejects.toThrow(/needs a caregiver/)
    await expect(makeBooking({ family, status: 'requested', caregiver })).rejects.toThrow(/no caregiver/)

    // the rule is real: the same rows written by hand are refused by bookings_status_caregiver_check
    const recipient = await makeRecipient({ family })
    const refused = await serviceClient()
      .from('bookings')
      .insert({ account_id: family.userId, care_recipient_id: recipient.id, bundle_code: 'medicheck', requested_datetime: nairobiTime().toISOString(), status: 'assigned' })
    expect(refused.error?.code).toBe('23514')
  })

  test('an assigned booking from the factory has the same columns set as one made by assign_booking', async () => {
    const admin = await makeAdmin()
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })

    const real = await makeBooking({ family })
    const assigned = await admin.client.rpc('assign_booking', { p_booking_id: real.id, p_caregiver_id: caregiver.userId })
    expect(assigned.error).toBeNull()
    const built = await makeBooking({ family, status: 'assigned', caregiver })

    const read = async (id: string) => {
      const booking = (await serviceClient().from('bookings').select('status, assigned_caregiver_id, assigned_by, assigned_at').eq('id', id).single()).data!
      const assignment = (await serviceClient().from('booking_assignments').select('caregiver_id, previous_caregiver_id, assigned_by, created_at').eq('booking_id', id)).data!
      return { booking, assignment }
    }
    const [a, b] = [await read(real.id), await read(built.id)]
    const shape = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null ? 'null' : 'set']))
    expect(shape(b.booking)).toEqual(shape(a.booking))
    expect(a.assignment).toHaveLength(1)
    expect(b.assignment).toHaveLength(1)
    expect(shape(b.assignment[0])).toEqual(shape(a.assignment[0]))
    expect(b.booking.status).toBe(a.booking.status)
    expect(b.booking.assigned_caregiver_id).toBe(a.booking.assigned_caregiver_id)
    expect(a.assignment[0].previous_caregiver_id).toBeNull()
    expect(b.assignment[0].previous_caregiver_id).toBeNull()
  })
})

test.describe('factories — makeRecipient({ careNotes })', () => {
  test('the default care notes carry a unique marker that is returned, and your own text is used as given', async () => {
    const family = await makeFamily()
    const [one, two, custom, none] = await Promise.all([
      makeRecipient({ family }),
      makeRecipient({ family }),
      makeRecipient({ family, careNotes: 'Allergic to penicillin.' }),
      makeRecipient({ family, careNotes: null }),
    ])
    expect(one.marker).toBeTruthy()
    expect(one.careNotes).toContain(one.marker!)
    expect(two.marker).not.toBe(one.marker)
    expect(custom.careNotes).toBe('Allergic to penicillin.')
    expect(custom.marker).toBe('Allergic to penicillin.')
    expect(none.careNotes).toBeNull()
    expect(none.marker).toBeNull()

    const stored = await serviceClient().from('care_recipients').select('id, care_notes').in('id', [one.id, custom.id, none.id])
    const byId = Object.fromEntries((stored.data ?? []).map((row) => [row.id, row.care_notes]))
    expect(byId[one.id]).toBe(one.careNotes)
    expect(byId[custom.id]).toBe('Allergic to penicillin.')
    expect(byId[none.id]).toBeNull()
  })

  test('the marker proves the notes are gone from API responses when the caregiver loses access (AC-021)', async () => {
    const admin = await makeAdmin()
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const recipient = await makeRecipient({ family })
    const booking = await makeBooking({ family, recipient, status: 'assigned', caregiver })

    // while assigned and Verified, the caregiver reads the notes
    const before = await caregiver.client.from('care_recipients').select('care_notes').eq('id', recipient.id)
    expect(JSON.stringify(before.data)).toContain(recipient.marker!)

    // the Admin removes Verified through the real function: the notes are gone from every response
    const removed = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: caregiver.userId, p_note: 'Reference failed' })
    expect(removed.error).toBeNull()
    const after = await caregiver.client.from('care_recipients').select('*').eq('id', recipient.id)
    expect(after.data).toEqual([])
    expect(JSON.stringify(after)).not.toContain(recipient.marker!)
    const bookings = await caregiver.client.from('bookings').select('*').eq('id', booking.id)
    expect(bookings.data).toEqual([])

    // and the family's own view of the booking never carried the notes
    const familyView = await family.client.from('family_bookings').select('*').eq('id', booking.id)
    expect(familyView.data).toHaveLength(1)
    expect(JSON.stringify(familyView.data)).not.toContain(recipient.marker!)
  })
})

test.describe('factories — dates in Africa/Nairobi', () => {
  test('nairobiTime gives the wall time in Nairobi, and two calls on one day are on one Nairobi day', () => {
    expect(NAIROBI_OFFSET_HOURS).toBe(3)
    const morning = nairobiTime({ days: 2, hour: 9 })
    const afternoon = nairobiTime({ days: 2, hour: 14 })
    expect(morning.getUTCHours()).toBe(6)
    expect(formatDateTime(morning)).toMatch(/, 09:00 EAT$/)
    expect(formatDateTime(afternoon)).toMatch(/, 14:00 EAT$/)
    expect(formatDate(morning)).toBe(formatDate(afternoon))
    expect(afternoon.getTime() - morning.getTime()).toBe(5 * 60 * 60 * 1000)
    expect(nairobiTime({ days: 3 }).getTime() - nairobiTime({ days: 2 }).getTime()).toBe(24 * 60 * 60 * 1000)
  })

  test('"today" is today in Nairobi, not in UTC: at 22:30 UTC it is already tomorrow there', () => {
    const lateEvening = new Date('2030-01-15T22:30:00.000Z') // 01:30 on the 16th in Nairobi
    expect(nairobiTime({ days: 0, hour: 9, now: lateEvening }).toISOString()).toBe('2030-01-16T06:00:00.000Z')
    const earlyMorning = new Date('2030-01-15T02:30:00.000Z') // 05:30 on the 15th in Nairobi
    expect(nairobiTime({ days: 0, hour: 9, now: earlyMorning }).toISOString()).toBe('2030-01-15T06:00:00.000Z')
    // month and year ends carry over correctly
    expect(nairobiTime({ days: 1, hour: 9, now: new Date('2029-12-31T10:00:00.000Z') }).toISOString()).toBe('2030-01-01T06:00:00.000Z')
  })

  test('a booking made with the defaults is on a Nairobi morning in the future', async () => {
    const family = await makeFamily()
    const booking = await makeBooking({ family })
    expect(new Date(booking.visit).getTime()).toBeGreaterThan(Date.now())
    expect(formatDateTime(booking.visit)).toMatch(/, 09:00 EAT$/)
  })
})

test.describe('factories — their data drives the real screens', () => {
  test('a booking whose caregiver has lost Verified shows Booking Detail state 3 to its family', async ({ page }) => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: 'removed' })
    const booking = await makeBooking({ family, status: 'assigned', caregiver })

    await logInViaUI(page, family.email, family.password)
    await page.goto(`/bookings/${booking.id}`)
    await expect(page.getByText('Vizazi Care is confirming your caregiver for this visit.')).toBeVisible()
    await expect(page.getByText(caregiver.fullName)).toHaveCount(0)
  })
})
