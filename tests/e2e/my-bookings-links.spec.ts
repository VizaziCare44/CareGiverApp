import { test, expect, type Page } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI } from './helpers'

// DEV-046: the two ways into My Bookings (frame ACC-10; FR-017; §5.7(l)):
// "My bookings" on the Care Recipient List and "View my bookings" on Booking
// Confirmation. They are the only change to those two screens.

async function bookThroughTheUI(page: Page, recipientId: string, recipientName: string) {
  await page.goto(`/book/bundle?recipientId=${recipientId}&recipientName=${encodeURIComponent(recipientName)}`)
  await page.getByTestId('bundle-card-medicheck').click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/book/datetime')
  const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await page.locator('#visit-date').fill(date)
  await page.locator('#visit-time').fill('09:00')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/book/review')
  await page.getByTestId('submit-booking').click()
  await page.waitForURL('**/book/confirmation')
}

test.describe('DEV-046 — links into My Bookings', () => {
  test('the Care Recipient List has a "My bookings" link that opens My Bookings', async ({ page }) => {
    const stamp = Date.now()
    const family = await createUserWithRole('family_member', `Family ${stamp}`)
    await apiAddRecipient(family.client, family.userId, `Linked ${stamp}`)
    await logInViaUI(page, family.email)

    const link = page.getByRole('link', { name: 'My bookings' })
    await expect(link).toHaveAttribute('href', '/bookings')
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    // the rest of the screen is as it was
    await expect(page.getByRole('heading', { name: 'Care recipients' })).toBeVisible()
    await expect(page.getByRole('button', { name: `Book care for Linked ${stamp}` })).toBeVisible()

    await link.click()
    await page.waitForURL('**/bookings')
    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible()
  })

  test('the link is also there on the first-time empty state', async ({ page }) => {
    const family = await createUserWithRole('family_member', 'No Recipients Yet')
    await logInViaUI(page, family.email)
    await expect(page.getByText('Add your first care recipient to get started.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'My bookings' })).toHaveAttribute('href', '/bookings')
  })

  test('after booking, Confirmation has "View my bookings", and the new booking is waiting there', async ({ page }) => {
    const stamp = Date.now()
    const family = await createUserWithRole('family_member', `Family ${stamp}`)
    const recipientName = `Booked ${stamp}`
    const recipientId = await apiAddRecipient(family.client, family.userId, recipientName)
    await logInViaUI(page, family.email)
    await bookThroughTheUI(page, recipientId, recipientName)

    await expect(page.getByText('Request received')).toBeVisible()
    const link = page.getByRole('link', { name: 'View my bookings' })
    await expect(link).toHaveAttribute('href', '/bookings')
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    // Done is still there and unchanged
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()

    await link.click()
    await page.waitForURL('**/bookings')
    const card = page.getByRole('listitem').filter({ hasText: recipientName })
    await expect(card).toContainText('MediCheck')
    await expect(card.getByText('Awaiting caregiver assignment')).toBeVisible()
  })

  test('Done on Confirmation still goes back to the Care Recipient List', async ({ page }) => {
    const stamp = Date.now()
    const family = await createUserWithRole('family_member', `Family ${stamp}`)
    const recipientId = await apiAddRecipient(family.client, family.userId, `Done ${stamp}`)
    await logInViaUI(page, family.email)
    await bookThroughTheUI(page, recipientId, `Done ${stamp}`)
    await page.getByRole('button', { name: 'Done' }).click()
    await page.waitForURL('**/recipients')
  })

  test('both links fit a phone: no sideways scrolling', async ({ page }) => {
    const family = await createUserWithRole('family_member', 'Narrow Family')
    await apiAddRecipient(family.client, family.userId, 'Narrow Recipient With A Fairly Long Name')
    await page.setViewportSize({ width: 375, height: 800 })
    await logInViaUI(page, family.email)
    await expect(page.getByRole('link', { name: 'My bookings' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    await page.goto('/book/confirmation')
    await expect(page.getByRole('link', { name: 'View my bookings' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})
