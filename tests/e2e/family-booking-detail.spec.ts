import { test, expect, type Page } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI, serviceClient } from './helpers'
import { CAREGIVER_BLOCK_TEXT } from '../../lib/bookings/caregiver-block'

// DEV-045: the family's Booking Detail and its caregiver block (frames VER-10 to
// 10d; FR-011, FR-012, FR-017; AC-011, AC-012). The four states of FD-VERIFY §6.1
// Flow E, chosen from the booking status and whether the caregiver is currently
// Verified, and what each one must and must not show.

const CAREGIVER_PHONE = '+254700000030' // createUserWithRole gives every account this number

async function setup(stamp: number) {
  const admin = await createUserWithRole('admin', `Ada ${stamp}`)
  const family = await createUserWithRole('family_member', `Family ${stamp}`)
  const care = await createUserWithRole('caregiver', `Detail Carer ${stamp}`)
  await admin.client.rpc('verify_caregiver', { p_caregiver_id: care.userId, p_note: 'Met in person' })
  const book = async (label: string, visit = '2030-01-15T06:30:00.000Z') => {
    const recipientId = await apiAddRecipient(family.client, family.userId, `${label} ${stamp}`)
    const { data } = await family.client
      .from('bookings')
      .insert({ account_id: family.userId, care_recipient_id: recipientId, bundle_code: 'medicheck', requested_datetime: visit })
      .select('id')
      .single()
    return data!.id as string
  }
  const assign = async (id: string) => {
    const result = await admin.client.rpc('assign_booking', { p_booking_id: id, p_caregiver_id: care.userId })
    expect(result.error).toBeNull()
  }
  const start = async (id: string, status: 'in_progress' | 'completed') => {
    expect((await serviceClient().from('bookings').update({ status }).eq('id', id)).error).toBeNull()
  }
  const unverify = async () => {
    const removed = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: care.userId, p_note: 'Reference failed' })
    expect(removed.error).toBeNull()
  }
  return { admin, family, care, book, assign, start, unverify }
}

async function open(page: Page, email: string, bookingId: string) {
  await logInViaUI(page, email, undefined, '**/recipients')
  await page.goto(`/bookings/${bookingId}`)
}

const caregiverSection = (page: Page) => page.getByRole('region', { name: 'Caregiver' })
const statusRow = (page: Page) => page.getByRole('region', { name: 'Booking' })

test.describe('DEV-045 — family Booking Detail', () => {
  test('state 1: awaiting assignment shows the summary and the assigning line, no caregiver', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { family, book } = await setup(stamp)
    const id = await book('Waiting')
    await open(page, family.email, id)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`MediCheck for Waiting ${stamp}`)
    const summary = statusRow(page)
    await expect(summary).toContainText(`Waiting ${stamp}`)
    await expect(summary).toContainText('MediCheck')
    await expect(summary).toContainText('Tue 15 Jan 2030, 09:30 EAT')
    const chip = summary.getByText('Awaiting caregiver assignment')
    await expect(chip).toBeVisible()
    await expect(chip).toHaveCSS('background-color', 'rgb(255, 243, 220)')
    await expect(summary.locator('svg[data-icon="clock"]')).toHaveCount(1)

    await expect(caregiverSection(page)).toContainText("We're assigning a caregiver…")
    await expect(page.getByRole('heading', { name: 'Your caregiver' })).toHaveCount(0)
    await expect(page.getByText('Verified')).toHaveCount(0)
    await testInfo.attach('booking-detail-state-1', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('state 2: a Verified caregiver shows the name, the Verified pill and the sentence directly beneath it, and nothing else', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { family, book, assign } = await setup(stamp)
    const id = await book('Assigned')
    await assign(id)
    await open(page, family.email, id)

    await expect(statusRow(page).getByText('Caregiver assigned')).toBeVisible()
    await expect(statusRow(page).locator('svg[data-icon="check"]')).toHaveCount(1)

    const block = page.getByRole('region', { name: 'Your caregiver' })
    await expect(block.getByRole('heading', { name: 'Your caregiver' })).toBeVisible()
    await expect(block).toContainText(`Detail Carer ${stamp}`)
    const pill = block.getByText('Verified', { exact: true })
    await expect(pill).toBeVisible()
    await expect(pill).toHaveCSS('background-color', 'rgb(227, 244, 242)')
    await expect(block.locator('svg[data-icon="check"]')).toHaveCount(1)

    // the founder-confirmed sentence, always visible, directly beneath the pill
    const sentence = block.getByText(CAREGIVER_BLOCK_TEXT.verifiedSentence, { exact: true })
    await expect(sentence).toBeVisible()
    const pillBox = (await pill.boundingBox())!
    const sentenceBox = (await sentence.boundingBox())!
    expect(sentenceBox.y).toBeGreaterThanOrEqual(pillBox.y + pillBox.height)
    expect(sentenceBox.y - (pillBox.y + pillBox.height)).toBeLessThan(24)

    // no phone, email, photo or link to the caregiver
    const text = await page.locator('body').innerText()
    expect(text).not.toContain(CAREGIVER_PHONE)
    expect(text).not.toContain('@')
    await expect(block.locator('img, a')).toHaveCount(0)
    await testInfo.attach('booking-detail-state-2', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('state 3: assigned but the caregiver is no longer Verified: only the clock and the confirming sentence', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { family, book, assign, unverify } = await setup(stamp)
    const id = await book('Confirming')
    await assign(id)
    await unverify()
    await open(page, family.email, id)

    await expect(statusRow(page).getByText('Confirming your caregiver')).toBeVisible()
    const block = caregiverSection(page)
    await expect(block).toContainText('Vizazi Care is confirming your caregiver for this visit.')
    await expect(block.locator('svg[data-icon="clock"]')).toHaveCount(1)
    // neither name, badge nor explanation
    await expect(page.getByText(`Detail Carer ${stamp}`)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Your caregiver' })).toHaveCount(0)
    await expect(page.getByText(/verified/i)).toHaveCount(0)
    await expect(page.getByText(CAREGIVER_BLOCK_TEXT.verifiedSentence)).toHaveCount(0)
    await testInfo.attach('booking-detail-state-3', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('state 4: a started or finished visit whose caregiver is no longer Verified shows "Your caregiver" and the name, nothing more', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { family, book, assign, start, unverify } = await setup(stamp)
    const started = await book('Started', '2030-01-16T06:30:00.000Z')
    const finished = await book('Finished', '2030-01-17T06:30:00.000Z')
    await assign(started)
    await assign(finished)
    await start(started, 'in_progress')
    await start(finished, 'completed')
    await unverify()

    await logInViaUI(page, family.email, undefined, '**/recipients')
    for (const [id, status] of [[started, 'In progress'], [finished, 'Completed']] as const) {
      await page.goto(`/bookings/${id}`)
      // the status stays the plain text, not "Confirming your caregiver"
      await expect(statusRow(page).getByText(status, { exact: true })).toBeVisible()
      await expect(statusRow(page).getByText(status, { exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(page.getByText('Confirming your caregiver')).toHaveCount(0)

      const block = page.getByRole('region', { name: 'Your caregiver' })
      await expect(block.getByRole('heading', { name: 'Your caregiver' })).toBeVisible()
      await expect(block).toContainText(`Detail Carer ${stamp}`)
      // no badge, no explanation, no "Not verified", no apology, no reason
      await expect(page.getByText(/verified|sorry|apolog|reason|confirming|no longer/i)).toHaveCount(0)
      await expect(block.locator('svg')).toHaveCount(0)
    }
    await testInfo.attach('booking-detail-state-4', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('a started or finished visit whose caregiver is Verified shows state 2', async ({ page }) => {
    const stamp = Date.now()
    const { family, book, assign, start } = await setup(stamp)
    const started = await book('Going', '2030-01-16T06:30:00.000Z')
    await assign(started)
    await start(started, 'in_progress')
    await open(page, family.email, started)

    await expect(statusRow(page).getByText('In progress', { exact: true })).toBeVisible()
    const block = page.getByRole('region', { name: 'Your caregiver' })
    await expect(block).toContainText(`Detail Carer ${stamp}`)
    await expect(block.getByText('Verified', { exact: true })).toBeVisible()
    await expect(block.getByText(CAREGIVER_BLOCK_TEXT.verifiedSentence)).toBeVisible()
  })

  test('the state follows the live status on the next load', async ({ page }) => {
    const stamp = Date.now()
    const { family, book, assign, unverify } = await setup(stamp)
    const id = await book('Live')
    await open(page, family.email, id)
    await expect(caregiverSection(page)).toContainText("We're assigning a caregiver…")

    await assign(id)
    await page.reload()
    await expect(page.getByRole('region', { name: 'Your caregiver' })).toContainText(`Detail Carer ${stamp}`)

    await unverify()
    await page.reload()
    await expect(caregiverSection(page)).toContainText('Vizazi Care is confirming your caregiver for this visit.')
    await expect(page.getByText(`Detail Carer ${stamp}`)).toHaveCount(0)
  })

  test('is reachable from My Bookings and goes back there; the app bar follows the Figma component', async ({ page }) => {
    const stamp = Date.now()
    const { family, book } = await setup(stamp)
    const id = await book('Reach')
    await logInViaUI(page, family.email, undefined, '**/recipients')
    await page.goto('/bookings')

    const card = page.getByRole('listitem').filter({ hasText: `Reach ${stamp}` })
    const link = card.getByRole('link', { name: 'View details' })
    await expect(link).toHaveAttribute('href', `/bookings/${id}`)
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await link.click()
    await page.waitForURL(`**/bookings/${id}`)

    // AppBar/Mobile: 56px high, white, 44×44 back target, 18px semibold title
    const bar = page.locator('header')
    expect((await bar.boundingBox())!.height).toBeCloseTo(56, 0)
    await expect(bar).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    const back = bar.getByRole('link', { name: 'Back to My bookings' })
    const box = (await back.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    const title = bar.getByText('Booking', { exact: true })
    await expect(title).toHaveCSS('font-size', '18px')
    await expect(title).toHaveCSS('font-weight', '600')

    await back.click()
    await page.waitForURL('**/bookings')
  })

  test("another family's booking, a made-up id, an Admin and a signed-out visitor all get nothing", async ({ page }) => {
    const stamp = Date.now()
    const mine = await setup(stamp)
    const other = await setup(stamp + 1)
    const theirs = await other.book('Theirs')
    const admin = await createUserWithRole('admin', 'Ada Guard')

    await logInViaUI(page, mine.family.email, undefined, '**/recipients')
    expect((await page.goto(`/bookings/${theirs}`))!.status()).toBe(404)
    expect((await page.goto('/bookings/not-an-id'))!.status()).toBe(404)
    expect((await page.goto('/bookings/00000000-0000-4000-8000-000000000000'))!.status()).toBe(404)

    await page.context().clearCookies()
    await page.goto(`/bookings/${theirs}`)
    await page.waitForURL('**/log-in')

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/bookings/${theirs}`)
    await page.waitForURL('**/admin/queue')
  })

  test('fits a phone: no sideways scrolling', async ({ page }) => {
    const stamp = Date.now()
    const { family, book, assign } = await setup(stamp)
    const id = await book('Narrow')
    await assign(id)
    await page.setViewportSize({ width: 375, height: 800 })
    await open(page, family.email, id)
    await expect(page.getByRole('region', { name: 'Your caregiver' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})
