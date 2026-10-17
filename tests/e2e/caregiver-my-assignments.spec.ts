import { test, expect, type Page } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI } from './helpers'

// DEV-047: the Caregiver's My Assignments (frames VER-11, 11b; FR-010; AC-010):
// their own assigned bookings, soonest first, each with the date and time, the
// recipient's name and the exact bundle line; the empty message; the line about
// contacting Vizazi Care with its own address row; a Caregiver lands here after
// Log In, and each role stays in its own area.

const CONTACT_EMAIL = 'vizazicare@gmail.com'

async function setup(stamp: number) {
  const admin = await createUserWithRole('admin', `Ada ${stamp}`)
  const family = await createUserWithRole('family_member', `Family ${stamp}`)
  const mine = await createUserWithRole('caregiver', `Mine ${stamp}`)
  const other = await createUserWithRole('caregiver', `Other ${stamp}`)
  for (const caregiver of [mine, other]) {
    await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
  }
  const book = async (label: string, visit: string, bundle = 'medicheck') => {
    const recipientId = await apiAddRecipient(family.client, family.userId, `${label} ${stamp}`)
    const { data } = await family.client
      .from('bookings')
      .insert({ account_id: family.userId, care_recipient_id: recipientId, bundle_code: bundle, requested_datetime: visit })
      .select('id')
      .single()
    return data!.id as string
  }
  const assign = async (bookingId: string, caregiverId: string) => {
    const result = await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: caregiverId })
    expect(result.error).toBeNull()
  }
  return { admin, family, mine, other, book, assign }
}

const loginAsCaregiver = (page: Page, email: string) => logInViaUI(page, email, undefined, '**/assignments')
const row = (page: Page, label: string, stamp: number) => page.getByRole('listitem').filter({ hasText: `${label} ${stamp}` })

async function expectHelp(page: Page) {
  // the sentence ends "…at"; the address is its own row below, an underlined mail link
  // at least 44px high and full width, with the full stop after it
  const sentence = page.getByText('If a booking you expected is missing, contact Vizazi Care at', { exact: true })
  await expect(sentence).toBeVisible()
  await expect(sentence).toHaveCSS('font-size', '14px')
  await expect(sentence).toHaveCSS('color', 'rgb(82, 96, 109)')

  const link = page.getByRole('link', { name: CONTACT_EMAIL })
  await expect(link).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`)
  await expect(link.getByText(CONTACT_EMAIL, { exact: true })).toHaveCSS('text-decoration-line', 'underline')
  await expect(link).toHaveText(`${CONTACT_EMAIL}.`)
  const sentenceBox = (await sentence.boundingBox())!
  const linkBox = (await link.boundingBox())!
  expect(linkBox.height).toBeGreaterThanOrEqual(44)
  expect(linkBox.y).toBeGreaterThanOrEqual(sentenceBox.y + sentenceBox.height)
  // full width: as wide as the column the sentence sits in
  const main = (await page.locator('main').boundingBox())!
  expect(linkBox.width).toBeGreaterThanOrEqual(main.width - 2 * 24 - 1)
  // the sentence is not repeated with the address inline
  await expect(page.getByText(new RegExp(`at ${CONTACT_EMAIL}`))).toHaveCount(0)
}

test.describe('DEV-047 — caregiver My Assignments', () => {
  test('a Caregiver lands on My Assignments after Log In, with their own bookings soonest first', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { mine, other, book, assign } = await setup(stamp)
    // created out of order on purpose; the page sorts by visit time
    const later = await book('Later', '2030-01-17T06:30:00.000Z', 'doctors_day_out')
    const sooner = await book('Sooner', '2030-01-15T06:30:00.000Z')
    const theirs = await book('Theirs', '2030-01-16T06:30:00.000Z')
    await book('Unassigned', '2030-01-18T06:30:00.000Z')
    await assign(later, mine.userId)
    await assign(sooner, mine.userId)
    await assign(theirs, other.userId)

    await loginAsCaregiver(page, mine.email)
    await expect(page.getByRole('heading', { name: 'My assignments' })).toBeVisible()

    const texts = await page.getByRole('listitem').allInnerTexts()
    expect(texts).toHaveLength(2)
    expect(texts[0]).toContain(`Sooner ${stamp}`)
    expect(texts[1]).toContain(`Later ${stamp}`)

    // date and time (Africa/Nairobi), recipient and the exact bundle line
    await expect(row(page, 'Sooner', stamp)).toContainText('Tue 15 Jan 2030, 09:30 EAT')
    await expect(row(page, 'Sooner', stamp)).toContainText('MediCheck · 3-hour visit')
    await expect(row(page, 'Later', stamp)).toContainText('Thu 17 Jan 2030, 09:30 EAT')
    await expect(row(page, 'Later', stamp)).toContainText("Doctor's Day Out · 4–5 hour visit")
    // no hyphen before "hour" in the second line
    await expect(page.getByText("4-5 hour")).toHaveCount(0)

    // nothing about another caregiver's booking or an unassigned one
    await expect(page.getByText(`Theirs ${stamp}`)).toHaveCount(0)
    await expect(page.getByText(`Unassigned ${stamp}`)).toHaveCount(0)
    await expect(page.getByText(`Other ${stamp}`)).toHaveCount(0)
    // and no phone number for Vizazi Care, only the address
    expect(await page.locator('body').innerText()).not.toMatch(/\+\d{6,}/)

    await expectHelp(page)
    await testInfo.attach('my-assignments', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('no bookings: the empty message, with the contact line under it', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { mine, book, assign, other } = await setup(stamp)
    const theirs = await book('Theirs', '2030-01-16T06:30:00.000Z')
    await assign(theirs, other.userId)

    await loginAsCaregiver(page, mine.email)
    await expect(page.getByText('No bookings assigned to you yet. When Vizazi Care assigns you a visit, it will appear here.')).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveCount(0)
    await expect(page.getByText(`Theirs ${stamp}`)).toHaveCount(0)
    await expectHelp(page)
    await testInfo.attach('my-assignments-empty', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('a booking that is reassigned, or whose Caregiver is no longer Verified, is simply not listed', async ({ page }) => {
    const stamp = Date.now()
    const { admin, mine, other, book, assign } = await setup(stamp)
    const stays = await book('Stays', '2030-01-15T06:30:00.000Z')
    const moved = await book('Moved', '2030-01-16T06:30:00.000Z')
    await assign(stays, mine.userId)
    await assign(moved, mine.userId)

    await loginAsCaregiver(page, mine.email)
    await expect(page.getByRole('listitem')).toHaveCount(2)

    // reassigned to someone else: gone on the next load, no message about it
    const changed = await admin.client.rpc('change_booking_caregiver', { p_booking_id: moved, p_caregiver_id: other.userId })
    expect(changed.error).toBeNull()
    await page.reload()
    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByText(`Moved ${stamp}`)).toHaveCount(0)

    // no longer Verified: nothing is listed, and the page says the ordinary empty thing
    const removed = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: mine.userId, p_note: 'Reference failed' })
    expect(removed.error).toBeNull()
    await page.reload()
    await expect(page.getByRole('listitem')).toHaveCount(0)
    await expect(page.getByText('No bookings assigned to you yet.', { exact: false })).toBeVisible()
    await expect(page.getByText(/verified/i)).toHaveCount(0)
  })

  test('each role stays in its own area', async ({ page }) => {
    const stamp = Date.now()
    const { admin, family, mine } = await setup(stamp)

    // Caregiver: the family and Admin screens send them back to My Assignments
    await loginAsCaregiver(page, mine.email)
    for (const path of ['/recipients', '/bookings', '/admin/queue', '/log-in']) {
      await page.goto(path)
      await page.waitForURL('**/assignments')
    }

    // Family Member and Admin cannot open it; a signed-out visitor goes to Log In
    await page.context().clearCookies()
    await logInViaUI(page, family.email)
    await page.goto('/assignments')
    await page.waitForURL('**/recipients')

    await page.context().clearCookies()
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto('/assignments')
    await page.waitForURL('**/admin/queue')

    await page.context().clearCookies()
    await page.goto('/assignments')
    await page.waitForURL('**/log-in')
  })

  test('fits a phone: no sideways scrolling, in both states', async ({ page }) => {
    const stamp = Date.now()
    const { mine, book, assign } = await setup(stamp)
    const id = await book('Narrow Recipient With A Fairly Long Name', '2030-01-15T06:30:00.000Z', 'doctors_day_out')
    await page.setViewportSize({ width: 375, height: 800 })
    await loginAsCaregiver(page, mine.email)
    await expect(page.getByText('No bookings assigned to you yet.', { exact: false })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

    await assign(id, mine.userId)
    await page.reload()
    await expect(page.getByRole('listitem')).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})
