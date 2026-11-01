import { test, expect } from '@playwright/test'
import { formatDateTime, slotToInstant } from '../../lib/datetime'
import { logInViaUI, serviceClient } from './helpers'
import { makeFamily, makeRecipient } from './factories'

// DEV-068 / DEV-028 item (9): the date and time typed in the booking flow mean Nairobi
// time, whatever zone the family member's device is in. A browser in Los Angeles that types
// 09:00 stores 06:00 UTC, and the review screen reads it back as 09:00 EAT.

test.use({ timezoneId: 'America/Los_Angeles' })

test('a slot typed in a browser outside Nairobi is stored as Nairobi time', async ({ page }) => {
  const family = await makeFamily()
  const recipient = await makeRecipient({ family, name: 'Mama Akinyi' })
  await logInViaUI(page, family.email, family.password)

  await page.goto(`/book/bundle?recipientId=${recipient.id}&recipientName=${encodeURIComponent(recipient.name)}`)
  await page.getByTestId('bundle-card-medicheck').click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/book/datetime')

  const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await page.locator('#visit-date').fill(date)
  await page.locator('#visit-time').fill('09:00')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/book/review')

  const expected = slotToInstant(date, '09:00')
  await expect(page.getByText(formatDateTime(expected), { exact: true })).toBeVisible()

  await page.getByTestId('submit-booking').click()
  await page.waitForURL('**/book/confirmation')

  const { data, error } = await serviceClient().from('bookings').select('requested_datetime').eq('account_id', family.userId).single()
  expect(error).toBeNull()
  expect(new Date(data!.requested_datetime).toISOString()).toBe(expected)
  expect(expected.endsWith('T06:00:00.000Z')).toBe(true)
})

test('the earliest day on the date picker is today in Nairobi', async ({ page }) => {
  const family = await makeFamily()
  const recipient = await makeRecipient({ family, name: 'Mzee Baraka' })
  await logInViaUI(page, family.email, family.password)
  await page.goto(`/book/bundle?recipientId=${recipient.id}&recipientName=${encodeURIComponent(recipient.name)}`)
  await page.getByTestId('bundle-card-doctors_day_out').click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/book/datetime')
  const { nairobiToday } = await import('../../lib/datetime')
  const before = nairobiToday()
  const min = await page.locator('#visit-date').getAttribute('min')
  const after = nairobiToday()
  expect([before, after]).toContain(min)
})
