import { test, expect, type Page } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI, serviceClient } from './helpers'

// DEV-048: the Caregiver's Assignment Detail (frames VER-12, 12b; FR-010; AC-010):
// read-only recipient name, bundle, date and time and care notes; and, when the
// booking was reassigned or the Caregiver stopped being Verified, one message for
// both causes that shows nothing of the booking and gives no reason.

const CONTACT_EMAIL = 'vizazicare@gmail.com'
const FAMILY_PHONE = '+254700000030' // createUserWithRole gives every account this number
const NOTES = 'Takes tablets with breakfast.\nPrefers the radio on.'

async function setup(stamp: number) {
  const admin = await createUserWithRole('admin', `Ada ${stamp}`)
  const family = await createUserWithRole('family_member', `Family ${stamp}`)
  const mine = await createUserWithRole('caregiver', `Mine ${stamp}`)
  const other = await createUserWithRole('caregiver', `Other ${stamp}`)
  for (const caregiver of [mine, other]) {
    await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
  }
  const book = async (label: string, opts: { notes?: string; visit?: string; bundle?: string } = {}) => {
    const recipientId = await apiAddRecipient(family.client, family.userId, `${label} ${stamp}`)
    if (opts.notes) {
      const saved = await serviceClient().from('care_recipients').update({ care_notes: opts.notes }).eq('id', recipientId)
      expect(saved.error).toBeNull()
    }
    const { data } = await family.client
      .from('bookings')
      .insert({
        account_id: family.userId,
        care_recipient_id: recipientId,
        bundle_code: opts.bundle ?? 'medicheck',
        requested_datetime: opts.visit ?? '2030-01-15T06:30:00.000Z',
      })
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

const UNAVAILABLE = 'This booking is no longer available to you.'

async function expectUnavailable(page: Page, stamp: number) {
  await expect(page.getByRole('heading', { name: UNAVAILABLE })).toBeVisible()
  const line = page.getByText(/^Its details and care notes are no longer shown\./)
  await expect(line).toHaveText(`Its details and care notes are no longer shown. If you weren't expecting this, contact Vizazi Care at ${CONTACT_EMAIL}.`)
  // the address is inline in the sentence, an underlined mail link, not a row of its own
  const mail = line.getByRole('link', { name: CONTACT_EMAIL })
  await expect(mail).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`)
  await expect(mail).toHaveCSS('text-decoration-line', 'underline')
  expect(((await mail.boundingBox())!.height)).toBeLessThan(44)
  const back = page.getByRole('link', { name: 'Back to my assignments' })
  await expect(back).toHaveAttribute('href', '/assignments')
  // nothing of the booking, no reason, and none of the forbidden words
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/verified|removed|reassign/i)
  expect(text).not.toContain(String(stamp))
  expect(text).not.toContain('Takes tablets')
  await expect(page.locator('header')).toHaveCount(0)
}

test.describe('DEV-048 — caregiver Assignment Detail', () => {
  test('shows the recipient, bundle, date and time and care notes, read-only, reached from My Assignments', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { mine, book, assign } = await setup(stamp)
    const id = await book('Noted', { notes: NOTES, bundle: 'doctors_day_out' })
    await assign(id, mine.userId)

    await logInViaUI(page, mine.email, undefined, '**/assignments')
    const link = page.getByRole('listitem').filter({ hasText: `Noted ${stamp}` }).getByRole('link', { name: 'View details' })
    await expect(link).toHaveAttribute('href', `/assignments/${id}`)
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await link.click()
    await page.waitForURL(`**/assignments/${id}`)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Noted ${stamp}`)
    const booking = page.getByRole('region', { name: 'Booking' })
    await expect(booking).toContainText(`Noted ${stamp}`)
    await expect(booking).toContainText("Doctor's Day Out · 4–5 hour visit")
    await expect(booking).toContainText('Tue 15 Jan 2030, 09:30 EAT')
    const notes = page.getByRole('region', { name: 'Care notes' })
    await expect(notes.getByRole('heading', { name: 'Care notes' })).toBeVisible()
    await expect(notes).toContainText('Takes tablets with breakfast.')
    await expect(notes).toContainText('Prefers the radio on.')

    // read-only: nothing to type into or press, and nothing about the family
    await expect(page.locator('main').locator('input, textarea, select, button')).toHaveCount(0)
    const text = await page.locator('body').innerText()
    expect(text).not.toContain(FAMILY_PHONE)
    expect(text).not.toContain(`Family ${stamp}`)
    expect(text).not.toContain('@')
    await testInfo.attach('assignment-detail', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // the app bar follows the Figma component and goes back to the list
    const bar = page.locator('header')
    expect((await bar.boundingBox())!.height).toBeCloseTo(56, 0)
    const back = bar.getByRole('link', { name: 'Back to my assignments' })
    const box = (await back.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    await expect(bar.getByText('Assignment', { exact: true })).toHaveCSS('font-size', '18px')
    await back.click()
    await page.waitForURL('**/assignments')
  })

  test('no care notes: it says so', async ({ page }) => {
    const stamp = Date.now()
    const { mine, book, assign } = await setup(stamp)
    const id = await book('Plain')
    await assign(id, mine.userId)
    await logInViaUI(page, mine.email, undefined, '**/assignments')
    await page.goto(`/assignments/${id}`)
    await expect(page.getByRole('region', { name: 'Care notes' })).toContainText('No care notes given.')
  })

  test('reassigned while the screen is open: the next load shows the one message, with nothing of the booking', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { admin, mine, other, book, assign } = await setup(stamp)
    const id = await book('Moving', { notes: NOTES })
    await assign(id, mine.userId)
    await logInViaUI(page, mine.email, undefined, '**/assignments')
    await page.goto(`/assignments/${id}`)
    await expect(page.getByText('Takes tablets with breakfast.')).toBeVisible()

    const changed = await admin.client.rpc('change_booking_caregiver', { p_booking_id: id, p_caregiver_id: other.userId })
    expect(changed.error).toBeNull()
    await page.reload()

    await expectUnavailable(page, stamp)
    await testInfo.attach('assignment-unavailable', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // and the booking is no longer listed
    await page.getByRole('link', { name: 'Back to my assignments' }).click()
    await page.waitForURL('**/assignments')
    await expect(page.getByText(`Moving ${stamp}`)).toHaveCount(0)
  })

  test('the Caregiver stops being Verified: the same message, no different words', async ({ page }) => {
    const stamp = Date.now()
    const { admin, mine, book, assign } = await setup(stamp)
    const id = await book('Lost', { notes: NOTES })
    await assign(id, mine.userId)
    await logInViaUI(page, mine.email, undefined, '**/assignments')
    await page.goto(`/assignments/${id}`)
    await expect(page.getByRole('region', { name: 'Care notes' })).toBeVisible()

    const removed = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: mine.userId, p_note: 'Reference failed' })
    expect(removed.error).toBeNull()
    await page.reload()
    await expectUnavailable(page, stamp)

    // Verified again while still assigned: the booking comes back
    const again = await admin.client.rpc('verify_caregiver', { p_caregiver_id: mine.userId, p_note: 'Checked again' })
    expect(again.error).toBeNull()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Lost ${stamp}`)
  })

  test("someone else's booking, a booking that was never assigned and a made-up id all read the same; a malformed id is a 404", async ({ page }) => {
    const stamp = Date.now()
    const { other, book, assign, mine } = await setup(stamp)
    const theirs = await book('Theirs', { notes: NOTES })
    const unassigned = await book('Unassigned')
    await assign(theirs, other.userId)

    await logInViaUI(page, mine.email, undefined, '**/assignments')
    for (const id of [theirs, unassigned, '00000000-0000-4000-8000-000000000000']) {
      await page.goto(`/assignments/${id}`)
      await expectUnavailable(page, stamp)
    }
    expect((await page.goto('/assignments/not-an-id'))!.status()).toBe(404)
  })

  test('Family Members, Admins and signed-out visitors cannot open it', async ({ page }) => {
    const stamp = Date.now()
    const { admin, family, mine, book, assign } = await setup(stamp)
    const id = await book('Guarded')
    await assign(id, mine.userId)

    await logInViaUI(page, family.email)
    await page.goto(`/assignments/${id}`)
    await page.waitForURL('**/recipients')

    await page.context().clearCookies()
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/assignments/${id}`)
    await page.waitForURL('**/admin/queue')

    await page.context().clearCookies()
    await page.goto(`/assignments/${id}`)
    await page.waitForURL('**/log-in')
  })

  test('fits a phone: no sideways scrolling, in both states', async ({ page }) => {
    const stamp = Date.now()
    const { admin, mine, other, book, assign } = await setup(stamp)
    const id = await book('Narrow Recipient With A Fairly Long Name', { notes: 'A long note '.repeat(30) })
    await assign(id, mine.userId)
    await page.setViewportSize({ width: 375, height: 800 })
    await logInViaUI(page, mine.email, undefined, '**/assignments')
    await page.goto(`/assignments/${id}`)
    await expect(page.getByRole('region', { name: 'Care notes' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

    await admin.client.rpc('change_booking_caregiver', { p_booking_id: id, p_caregiver_id: other.userId })
    await page.reload()
    await expect(page.getByRole('heading', { name: UNAVAILABLE })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})
