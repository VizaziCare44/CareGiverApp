import { test, expect } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI, serviceClient } from './helpers'

// DEV-044: the family's My Bookings screen (frames VER-09, 09b; FR-017; AC-019):
// their own bookings from family_bookings, soonest first, each with the
// recipient, the bundle, the date and time (Africa/Nairobi) and a status label
// whose icon and words agree; a message and "Book care" when there are none.

async function setupFamily(stamp: number) {
  const admin = await createUserWithRole('admin', `Ada ${stamp}`)
  const family = await createUserWithRole('family_member', `Family ${stamp}`)
  const care = await createUserWithRole('caregiver', `Bookings Carer ${stamp}`)
  await admin.client.rpc('verify_caregiver', { p_caregiver_id: care.userId, p_note: 'Met in person' })
  const book = async (label: string, visit: string, bundle = 'medicheck') => {
    const recipientId = await apiAddRecipient(family.client, family.userId, `${label} ${stamp}`)
    const { data } = await family.client
      .from('bookings')
      .insert({ account_id: family.userId, care_recipient_id: recipientId, bundle_code: bundle, requested_datetime: visit })
      .select('id')
      .single()
    return data!.id as string
  }
  return { admin, family, care, book }
}

const card = (page: import('@playwright/test').Page, label: string, stamp: number) =>
  page.getByRole('listitem').filter({ hasText: `${label} ${stamp}` })

test.describe('DEV-044 — family My Bookings', () => {
  test('lists the bookings soonest first, each with recipient, bundle, EAT date and time, and a status label', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { admin, family, care, book } = await setupFamily(stamp)

    // created out of order on purpose: the page sorts by visit time, not by creation
    const startedId = await book('Started', '2030-01-18T06:30:00.000Z')
    const assignedId = await book('Assigned', '2030-01-16T06:30:00.000Z', 'doctors_day_out')
    const requestedId = await book('Waiting', '2030-01-15T06:30:00.000Z')
    const doneId = await book('Done', '2030-01-19T06:30:00.000Z')
    const lostId = await book('Lost', '2030-01-17T06:30:00.000Z')
    expect(requestedId).toBeTruthy()

    await admin.client.rpc('assign_booking', { p_booking_id: assignedId, p_caregiver_id: care.userId })
    await admin.client.rpc('assign_booking', { p_booking_id: lostId, p_caregiver_id: care.userId })
    for (const id of [startedId, doneId]) {
      await admin.client.rpc('assign_booking', { p_booking_id: id, p_caregiver_id: care.userId })
    }
    expect((await serviceClient().from('bookings').update({ status: 'in_progress' }).eq('id', startedId)).error).toBeNull()
    expect((await serviceClient().from('bookings').update({ status: 'completed' }).eq('id', doneId)).error).toBeNull()
    // the caregiver loses Verified: the booking that has not started needs confirming, the started ones do not
    await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: care.userId, p_note: 'Reference failed' })
    // ...but "assigned" with a Verified caregiver is the usual case, so give one booking a second, Verified caregiver
    const second = await createUserWithRole('caregiver', `Second Carer ${stamp}`)
    await admin.client.rpc('verify_caregiver', { p_caregiver_id: second.userId, p_note: 'Met in person' })
    await admin.client.rpc('change_booking_caregiver', { p_booking_id: assignedId, p_caregiver_id: second.userId })

    await logInViaUI(page, family.email, undefined, '**/recipients')
    await page.goto('/bookings')

    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible()

    // soonest first
    const order = await page.getByRole('listitem').allInnerTexts()
    const names = ['Waiting', 'Assigned', 'Lost', 'Started', 'Done'].map((label) => order.findIndex((text) => text.includes(`${label} ${stamp}`)))
    expect(names.every((i) => i >= 0)).toBe(true)
    expect([...names].sort((a, b) => a - b)).toEqual(names)

    // recipient, bundle, date and time in Africa/Nairobi
    const waiting = card(page, 'Waiting', stamp)
    await expect(waiting).toContainText('MediCheck')
    await expect(waiting).toContainText('Tue 15 Jan 2030, 09:30 EAT')
    await expect(card(page, 'Assigned', stamp)).toContainText("Doctor's Day Out")

    // status labels: icon and words together for the three waiting states, plain text for the rest
    await expect(waiting.getByText('Awaiting caregiver assignment')).toBeVisible()
    await expect(waiting.locator('svg[data-icon="clock"]')).toHaveCount(1)
    await expect(card(page, 'Assigned', stamp).getByText('Caregiver assigned')).toBeVisible()
    await expect(card(page, 'Assigned', stamp).locator('svg[data-icon="check"]')).toHaveCount(1)
    await expect(card(page, 'Lost', stamp).getByText('Confirming your caregiver')).toBeVisible()
    await expect(card(page, 'Lost', stamp).locator('svg[data-icon="clock"]')).toHaveCount(1)
    for (const [label, text] of [['Started', 'In progress'], ['Done', 'Completed']] as const) {
      await expect(card(page, label, stamp).getByText(text, { exact: true })).toBeVisible()
      await expect(card(page, label, stamp).locator('svg')).toHaveCount(0)
    }

    // the Figma chips: Chip/Clock is an amber pill (#fff3dc, text #7a4100), Chip/Check a soft-green pill
    // (#e3f4f2, text #0b5f5a); In progress and Completed are plain text with no pill
    const amber = { bg: 'rgb(255, 243, 220)', text: 'rgb(122, 65, 0)' }
    const soft = { bg: 'rgb(227, 244, 242)', text: 'rgb(11, 95, 90)' }
    for (const [label, words, colours] of [
      ['Waiting', 'Awaiting caregiver assignment', amber],
      ['Lost', 'Confirming your caregiver', amber],
      ['Assigned', 'Caregiver assigned', soft],
    ] as const) {
      const chip = card(page, label, stamp).getByText(words)
      await expect(chip).toHaveCSS('background-color', colours.bg)
      await expect(chip).toHaveCSS('color', colours.text)
      await expect(chip).toHaveCSS('font-size', '14px')
      await expect(chip).toHaveCSS('border-top-left-radius', '9999px')
      // the pill hugs its words (Figma's Chip/Clock is 250px wide), it does not stretch across the card
      expect((await chip.boundingBox())!.width).toBeLessThan(300)
    }
    for (const [label, words] of [['Started', 'In progress'], ['Done', 'Completed']] as const) {
      await expect(card(page, label, stamp).getByText(words, { exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    }

    // the icon is decorative: the words carry the meaning
    await expect(page.locator('svg[data-icon]').first()).toHaveAttribute('aria-hidden', 'true')
    // the family is told their caregiver is being confirmed, never that the caregiver lost Verified
    await expect(page.getByText(/verified/i)).toHaveCount(0)
    // no caregiver name appears on this screen
    await expect(page.getByText(new RegExp(`Carer ${stamp}`))).toHaveCount(0)

    await testInfo.attach('my-bookings', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('with no bookings: the message and a Book care action into the booking flow', async ({ page }) => {
    const family = await createUserWithRole('family_member', 'No Bookings Yet')
    await logInViaUI(page, family.email, undefined, '**/recipients')
    await page.goto('/bookings')

    await expect(page.getByText("You haven't requested a booking yet.")).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveCount(0)
    const action = page.getByRole('link', { name: 'Book care' })
    await expect(action).toHaveAttribute('href', '/recipients')
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await action.click()
    await page.waitForURL('**/recipients')
  })

  test("shows only the signed-in family's own bookings", async ({ page }) => {
    const stamp = Date.now()
    const mine = await setupFamily(stamp)
    const other = await setupFamily(stamp + 1)
    await mine.book('Mine', '2030-02-01T06:30:00.000Z')
    await other.book('Theirs', '2030-02-02T06:30:00.000Z')

    await logInViaUI(page, mine.family.email, undefined, '**/recipients')
    await page.goto('/bookings')
    await expect(card(page, 'Mine', stamp)).toBeVisible()
    await expect(page.getByText(`Theirs ${stamp + 1}`)).toHaveCount(0)
    await expect(page.getByRole('listitem')).toHaveCount(1)
  })

  test('is for Family Members only', async ({ page }) => {
    const admin = await createUserWithRole('admin', 'Ada Guard')
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto('/bookings')
    await page.waitForURL('**/admin/queue')

    await page.context().clearCookies()
    await page.goto('/bookings')
    await page.waitForURL('**/log-in')
  })

  test('fits a phone: no sideways scrolling', async ({ page }) => {
    const stamp = Date.now()
    const { family, book } = await setupFamily(stamp)
    await book('Narrow', '2030-02-03T06:30:00.000Z', 'doctors_day_out')
    await page.setViewportSize({ width: 375, height: 800 })
    await logInViaUI(page, family.email, undefined, '**/recipients')
    await page.goto('/bookings')
    await expect(card(page, 'Narrow', stamp)).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
