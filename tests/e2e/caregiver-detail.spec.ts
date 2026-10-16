import { test, expect } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI } from './helpers'

// DEV-037: the Admin Caregiver Detail screen (frames VER-02, 02b, 02c): status,
// who changed it last and when, the verification history (newest first), and
// the "Bookings that need a new caregiver" panel.

test.describe('DEV-037 — Admin Caregiver Detail', () => {
  test('shows status, the last change, and the history newest first', async ({ page }) => {
    const stamp = Date.now()
    const admin = await createUserWithRole('admin', `Ada ${stamp}`)
    const caregiver = await createUserWithRole('caregiver', `History Caregiver ${stamp}`)
    for (const [fn, note] of [
      ['verify_caregiver', 'Met in person'],
      ['remove_caregiver_verification', 'Reference failed'],
      ['verify_caregiver', 'Re-checked'],
    ]) {
      const { error } = await admin.client.rpc(fn, { p_caregiver_id: caregiver.userId, p_note: note })
      expect(error).toBeNull()
    }

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    // reached from the list
    await page.goto('/admin/caregivers')
    await page.getByRole('link', { name: new RegExp(`History Caregiver ${stamp}`) }).click()
    await page.waitForURL(`**/admin/caregivers/${caregiver.userId}`)

    await expect(page.getByRole('heading', { name: `History Caregiver ${stamp}`, level: 1 })).toBeVisible()
    await expect(page.getByText('Verified', { exact: true })).toBeVisible()
    await expect(page.getByText(new RegExp(`Last changed by Ada ${stamp} on [A-Z][a-z]{2} \\d{1,2} [A-Z][a-z]{2} \\d{4}, \\d{2}:\\d{2} EAT`))).toBeVisible()

    // one action at a time: the caregiver is Verified, so only Remove is offered
    await expect(page.getByRole('button', { name: 'Remove Verified' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Mark as Verified' })).toHaveCount(0)

    const entries = page.getByRole('region', { name: 'Verification history' }).getByRole('listitem')
    await expect(entries).toHaveCount(3)
    await expect(entries.nth(0)).toContainText('Marked as Verified')
    await expect(entries.nth(0)).toContainText('Re-checked')
    await expect(entries.nth(0)).toContainText(`By Ada ${stamp}`)
    await expect(entries.nth(1)).toContainText('Removed Verified status')
    await expect(entries.nth(1)).toContainText('Reference failed')
    await expect(entries.nth(2)).toContainText('Marked as Verified')
    await expect(entries.nth(2)).toContainText('Met in person')
  })

  test('a caregiver who was never verified', async ({ page }) => {
    const stamp = Date.now()
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const caregiver = await createUserWithRole('caregiver', `Fresh Caregiver ${stamp}`)

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/caregivers/${caregiver.userId}`)

    await expect(page.getByRole('heading', { name: `Fresh Caregiver ${stamp}`, level: 1 })).toBeVisible()
    await expect(page.getByText('Not verified', { exact: true })).toBeVisible()
    await expect(page.getByText(/Last changed by/)).toHaveCount(0)
    await expect(page.getByText('No verification changes yet.')).toBeVisible()
    await expect(page.getByText('No upcoming bookings are affected.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark as Verified' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Remove Verified' })).toHaveCount(0)
  })

  test('bookings that need a new caregiver appear when Verified is removed, and leave when reassigned', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const first = await createUserWithRole('caregiver', `First Caregiver ${stamp}`)
    const second = await createUserWithRole('caregiver', `Second Caregiver ${stamp}`)
    const family = await createUserWithRole('family_member', 'Family Member')
    for (const caregiver of [first, second]) {
      await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
    }

    const recipientId = await apiAddRecipient(family.client, family.userId, `Mzee ${stamp}`)
    const { data: booking } = await family.client
      .from('bookings')
      .insert({
        account_id: family.userId,
        care_recipient_id: recipientId,
        bundle_code: 'medicheck',
        requested_datetime: '2030-01-15T06:30:00.000Z',
      })
      .select('id')
      .single()
    await admin.client.rpc('assign_booking', { p_booking_id: booking!.id, p_caregiver_id: first.userId })

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    // Verified caregiver with a booking: nothing is affected
    await page.goto(`/admin/caregivers/${first.userId}`)
    await expect(page.getByText('No upcoming bookings are affected.')).toBeVisible()

    // Verified removed: the booking needs a new caregiver
    await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: first.userId, p_note: 'Reference failed' })
    await page.reload()
    const panel = page.getByRole('region', { name: 'Bookings that need a new caregiver' })
    await expect(panel.getByText('Tue 15 Jan 2030, 09:30 EAT')).toBeVisible()
    await expect(panel.getByText(`For Mzee ${stamp}`)).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Reassign' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Mark as Verified' })).toBeDisabled()
    await testInfo.attach('caregiver-detail', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // reassigned: it is no longer assigned to this caregiver, so the panel clears
    await admin.client.rpc('change_booking_caregiver', { p_booking_id: booking!.id, p_caregiver_id: second.userId })
    await page.reload()
    await expect(page.getByText('No upcoming bookings are affected.')).toBeVisible()
  })

  test('unknown or malformed ids are not found, and only Admins can open the screen', async ({ page }) => {
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const family = await createUserWithRole('family_member', 'Not A Caregiver')
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    for (const id of ['not-a-uuid', '00000000-0000-0000-0000-00000000dead', family.userId]) {
      const response = await page.goto(`/admin/caregivers/${id}`)
      expect(response?.status(), id).toBe(404)
    }

    await page.context().clearCookies()
    await logInViaUI(page, family.email)
    await page.goto(`/admin/caregivers/${family.userId}`)
    await expect(page).toHaveURL(/\/recipients/)
  })
})
