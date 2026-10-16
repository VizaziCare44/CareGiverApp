import { test, expect } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI, serviceClient } from './helpers'

// DEV-041: the Admin Booking Detail screen (frames VER-06, 06b, 06c): recipient,
// care notes, bundle, visit, status, requested at; once assigned, the caregiver
// with their verification status, who assigned and when; one action by status,
// and none once the visit has started.

async function setup(stamp: number) {
  const admin = await createUserWithRole('admin', `Ada ${stamp}`)
  const caregiver = await createUserWithRole('caregiver', `Detail Caregiver ${stamp}`)
  const family = await createUserWithRole('family_member', `Family ${stamp}`)
  await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })

  const book = async (label: string, careNotes?: string) => {
    const recipientId = await apiAddRecipient(family.client, family.userId, `${label} ${stamp}`)
    if (careNotes) await family.client.from('care_recipients').update({ care_notes: careNotes }).eq('id', recipientId)
    const { data } = await family.client
      .from('bookings')
      .insert({
        account_id: family.userId,
        care_recipient_id: recipientId,
        bundle_code: 'medicheck',
        requested_datetime: '2030-01-15T06:30:00.000Z',
      })
      .select('id')
      .single()
    return data!.id as string
  }
  return { admin, caregiver, family, book }
}

test.describe('DEV-041 — Admin Booking Detail', () => {
  test('a requested booking: the booking details, the Assign caregiver action, no caregiver block', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { admin, book } = await setup(stamp)
    const bookingId = await book('Requested', 'Takes insulin at 8am\nAllergic to penicillin')

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    // reached from the queue, by its own link
    const row = page.getByRole('listitem').filter({ hasText: `Recipient: Requested ${stamp}` })
    await row.getByRole('link', { name: 'View details' }).click()
    await page.waitForURL(`**/admin/bookings/${bookingId}`)
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Booking queue' })).toHaveAttribute('aria-current', 'page')

    await expect(page.getByRole('heading', { name: `MediCheck for Requested ${stamp}`, level: 1 })).toBeVisible()
    const details = page.getByRole('region', { name: 'Booking', exact: true })
    await expect(details.getByText(`Requested ${stamp}`, { exact: true })).toBeVisible()
    await expect(details.getByText(/Takes insulin at 8am/)).toBeVisible()
    await expect(details.getByText(/Allergic to penicillin/)).toBeVisible()
    await expect(details.getByText('Tue 15 Jan 2030, 09:30 EAT')).toBeVisible()
    await expect(details.getByText('Requested', { exact: true }).first()).toBeVisible()
    await expect(details.getByText(/[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} EAT/).first()).toBeVisible()
    await expect(details.getByText(`Family ${stamp} · `)).toBeVisible()

    // not assigned: no caregiver block; one action, Assign caregiver
    await expect(page.getByRole('region', { name: 'Caregiver' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Assign caregiver' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Change caregiver' })).toHaveCount(0)
    await expect(page.getByText(/Visit started/)).toHaveCount(0)
    await testInfo.attach('booking-detail', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('no care notes', async ({ page }) => {
    const stamp = Date.now()
    const { admin, book } = await setup(stamp)
    const bookingId = await book('NoNotes')
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/bookings/${bookingId}`)
    await expect(page.getByText('No care notes given.')).toBeVisible()
  })

  test('an assigned booking: the caregiver, whether Verified, who assigned and when, and Change caregiver', async ({ page }) => {
    const stamp = Date.now()
    const { admin, caregiver, book } = await setup(stamp)
    const bookingId = await book('Assigned')
    await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: caregiver.userId })

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/bookings/${bookingId}`)

    const block = page.getByRole('region', { name: 'Caregiver' })
    await expect(block.getByText(`Detail Caregiver ${stamp}`)).toBeVisible()
    await expect(block.getByText('Verified', { exact: true })).toBeVisible()
    await expect(block.getByText(`Ada ${stamp}`)).toBeVisible()
    await expect(block.getByText(/[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} EAT/)).toBeVisible()
    await expect(block.getByText('Caregiver no longer Verified — reassign')).toHaveCount(0)

    // assigned, visit not started: Change caregiver is the one action
    await expect(page.getByRole('button', { name: 'Change caregiver' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Assign caregiver' })).toHaveCount(0)
  })

  test('the caregiver lost Verified: shown as Not verified, with the reassign flag, while the visit has not started', async ({ page }) => {
    const stamp = Date.now()
    const { admin, caregiver, book } = await setup(stamp)
    const bookingId = await book('Lost')
    await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: caregiver.userId })
    await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: caregiver.userId, p_note: 'Reference failed' })

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/bookings/${bookingId}`)

    const block = page.getByRole('region', { name: 'Caregiver' })
    await expect(block.getByText('Not verified', { exact: true })).toBeVisible()
    await expect(block.getByText('Caregiver no longer Verified — reassign')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Change caregiver' })).toBeDisabled()
  })

  test('once the visit has started there is no change action, whatever the caregiver status (AC-008)', async ({ page }) => {
    const stamp = Date.now()
    const { admin, caregiver, book } = await setup(stamp)
    const bookingId = await book('Started')
    await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: caregiver.userId })
    // the visit starts (no function for that exists yet, so the service role does it) and the caregiver loses Verified
    const started = await serviceClient().from('bookings').update({ status: 'in_progress' }).eq('id', bookingId)
    expect(started.error).toBeNull()
    await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: caregiver.userId, p_note: 'Reference failed' })

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/bookings/${bookingId}`)

    const block = page.getByRole('region', { name: 'Caregiver' })
    await expect(block.getByText(`Detail Caregiver ${stamp}`)).toBeVisible()
    await expect(block.getByText('Not verified', { exact: true })).toBeVisible()
    await expect(page.getByText("Visit started — caregiver can't be changed here.")).toBeVisible()
    // no reassign flag and no action at all
    await expect(page.getByText('Caregiver no longer Verified — reassign')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /caregiver/i })).toHaveCount(0)
  })

  test('unknown or malformed ids are not found, and only Admins can open it', async ({ page }) => {
    const stamp = Date.now()
    const { admin, family, book } = await setup(stamp)
    const bookingId = await book('Guard')
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    for (const id of ['not-a-uuid', '00000000-0000-0000-0000-00000000dead']) {
      const response = await page.goto(`/admin/bookings/${id}`)
      expect(response?.status(), id).toBe(404)
    }

    await page.context().clearCookies()
    await logInViaUI(page, family.email)
    await page.goto(`/admin/bookings/${bookingId}`)
    await expect(page).toHaveURL(/\/recipients/)
  })
})
