import { test, expect } from '@playwright/test'
import { createUserWithRole, logInViaUI } from './helpers'

// DEV-036: the Admin Caregivers list (frame VER-01): name and status only,
// status always a text label plus an icon, "Caregivers" in the main navigation.

test.describe('DEV-036 — Admin Caregivers list', () => {
  test('an Admin finds Caregivers in the navigation and sees name and status', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const verified = await createUserWithRole('caregiver', `Verified Caregiver ${stamp}`)
    await createUserWithRole('caregiver', `Unverified Caregiver ${stamp}`)
    const { error } = await admin.client.rpc('verify_caregiver', { p_caregiver_id: verified.userId, p_note: 'Met in person' })
    expect(error).toBeNull()

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    // "Caregivers" sits in the main navigation next to the booking queue
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Booking queue' })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('link', { name: 'Caregivers' }).click()
    await page.waitForURL('**/admin/caregivers')
    await expect(page.getByRole('heading', { name: 'Caregivers' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Caregivers' })).toHaveAttribute('aria-current', 'page')

    // each caregiver shows the name and a status word (an icon sits beside it)
    const verifiedRow = page.getByRole('listitem').filter({ hasText: `Verified Caregiver ${stamp}` })
    await expect(verifiedRow.getByText('Verified', { exact: true })).toBeVisible()
    await expect(verifiedRow.locator('svg[aria-hidden="true"]')).toHaveCount(1)

    const unverifiedRow = page.getByRole('listitem').filter({ hasText: `Unverified Caregiver ${stamp}` })
    await expect(unverifiedRow.getByText('Not verified', { exact: true })).toBeVisible()
    await expect(unverifiedRow.locator('svg[aria-hidden="true"]')).toHaveCount(1)

    // name and status only: nothing else about the caregiver is on the row
    await expect(verifiedRow).toHaveText(`Verified Caregiver ${stamp}Verified`)

    await testInfo.attach('caregivers-list', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('the list is for Admins only', async ({ page }) => {
    const family = await createUserWithRole('family_member', 'Not An Admin')
    await logInViaUI(page, family.email)

    await page.goto('/admin/caregivers')
    await expect(page).toHaveURL(/\/recipients/)
  })
})
