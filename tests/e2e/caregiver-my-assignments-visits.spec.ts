import { test, expect, type Page } from '@playwright/test'
import { formatDateTime } from '../../lib/datetime'
import { logInViaUI } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, nairobiDay, today, tomorrow, yesterday, type TestBooking, type TestCaregiver } from './factories'
import { personaState, personasAvailable } from './personas'

// DEV-063 (FD-VISIT frame VIS-01, §6.5, §7.8(c); FR-011, FR-016; AC-015; TC-VIS-009, TC-VIS-010, TC-VIS-011): My
// assignments with the visit in progress. The visit in progress first, in a bordered card with "In progress" as text
// plus a clock icon; the rest soonest first; a booking still assigned after its day has passed last, with "Visit day
// has passed" as text plus a dash icon; completed visits not listed. Every card has a chevron on the date line, top
// right, and opens Assignment Detail in the state that fits.

const stamp = Date.now()
const bundleLines = { medicheck: 'MediCheck · 3-hour visit', doctors_day_out: "Doctor's Day Out · 4–5 hour visit" }

interface Scenario {
  caregiver: TestCaregiver
  done: TestBooking
  open: TestBooking
  soon: TestBooking
  tomorrowCard: TestBooking
  passed: TestBooking
  names: Record<'done' | 'open' | 'soon' | 'tomorrow' | 'passed', string>
  visits: Record<'open' | 'soon' | 'tomorrow' | 'passed', Date>
}

/** V (Verified) has: P in progress, U1 assigned in 2 days, U2 assigned tomorrow (Doctor's Day Out), D assigned yesterday, C completed. */
async function scenario(suffix: string): Promise<Scenario> {
  const caregiver = await makeCaregiver({ verified: true })
  const family = await makeFamily()
  const names = { done: `Done ${suffix}`, open: `Open ${suffix}`, soon: `Soon ${suffix}`, tomorrow: `Tomorrow ${suffix}`, passed: `Passed ${suffix}` }
  const visits = { open: nairobiDay(today, '09:00'), soon: nairobiDay(2, '10:30'), tomorrow: nairobiDay(tomorrow, '14:00'), passed: nairobiDay(yesterday, '09:00') }
  const recipient = (name: string) => makeRecipient({ family, name })
  // the completed visit first: a caregiver has one visit open at a time
  const done = await makeBooking({ family, recipient: await recipient(names.done), status: 'completed', caregiver })
  const open = await makeBooking({ family, recipient: await recipient(names.open), status: 'in_progress', caregiver })
  const soon = await makeBooking({ family, recipient: await recipient(names.soon), status: 'assigned', caregiver, visit: visits.soon })
  const tomorrowCard = await makeBooking({ family, recipient: await recipient(names.tomorrow), bundle: 'doctors_day_out', status: 'assigned', caregiver, visit: visits.tomorrow })
  const passed = await makeBooking({ family, recipient: await recipient(names.passed), bundle: 'doctors_day_out', status: 'assigned', caregiver, visit: visits.passed })
  return { caregiver, done, open, soon, tomorrowCard, passed, names, visits }
}

const cards = (page: Page) => page.getByRole('listitem')
const cardOf = (page: Page, name: string) => cards(page).filter({ hasText: name })
const listText = async (page: Page) => (await cards(page).allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim())

test.describe('DEV-063 — My assignments with a visit in progress', () => {
  test('TC-VIS-009: the order, the cards, the two status lines, no completed visit; the same in another time zone', async ({ page, browser }) => {
    const s = await scenario(`${stamp}a`)
    await logInViaUI(page, s.caregiver.email, s.caregiver.password, '**/assignments')

    await expect(page.getByRole('heading', { level: 1, name: 'My assignments' })).toBeVisible()
    const here = await listText(page)
    // P first, then U2 (tomorrow) and U1 (in two days), then D (the passed day) last; C is not listed
    expect(here).toHaveLength(4)
    expect(here[0]).toContain(s.names.open)
    expect(here[1]).toContain(s.names.tomorrow)
    expect(here[2]).toContain(s.names.soon)
    expect(here[3]).toContain(s.names.passed)
    expect(here.join(' ')).not.toContain(s.names.done)

    // each card: the date and time ending EAT, the recipient, the exact bundle line
    const expectations: [string, Date, keyof typeof bundleLines][] = [
      [s.names.open, s.visits.open, 'medicheck'],
      [s.names.tomorrow, s.visits.tomorrow, 'doctors_day_out'],
      [s.names.soon, s.visits.soon, 'medicheck'],
      [s.names.passed, s.visits.passed, 'doctors_day_out'],
    ]
    for (const [name, visit, bundle] of expectations) {
      const card = cardOf(page, name)
      await expect(card).toContainText(formatDateTime(visit))
      await expect(card).toContainText(/ EAT/)
      await expect(card).toContainText(bundleLines[bundle])
      await expect(card.getByTestId('card-chevron')).toHaveCount(1)
    }
    await expect(page.getByText('4-5 hour')).toHaveCount(0)

    // P: "In progress" as text plus a clock icon, in a bordered card; D: "Visit day has passed" as text plus a dash icon
    const open = cardOf(page, s.names.open)
    await expect(open.getByText('In progress', { exact: true })).toBeVisible()
    await expect(open.locator('svg[data-icon="clock"]')).toHaveCount(1)
    const link = open.getByRole('link')
    expect(parseFloat(await link.evaluate((e) => getComputedStyle(e).borderTopWidth))).toBeGreaterThanOrEqual(2)
    const passed = cardOf(page, s.names.passed)
    await expect(passed.getByText('Visit day has passed', { exact: true })).toBeVisible()
    await expect(passed.locator('svg[data-icon="dash"]')).toHaveCount(1)
    expect(await passed.innerText()).not.toMatch(/late|overdue|missed/i)
    // a status line only on those two cards
    for (const name of [s.names.soon, s.names.tomorrow]) {
      const text = await cardOf(page, name).innerText()
      expect(text, name).not.toContain('In progress')
      expect(text, name).not.toContain('Visit day has passed')
      await expect(cardOf(page, name).locator('svg[data-icon]')).toHaveCount(0)
    }

    // the helper line under the list is still there, with its address on its own row
    await expect(page.getByText('If a booking you expected is missing, contact Vizazi Care at', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'vizazicare@gmail.com' })).toHaveAttribute('href', 'mailto:vizazicare@gmail.com')

    // Repeat in America/Los_Angeles: the same cards in the same order
    const other = await browser.newContext({ timezoneId: 'America/Los_Angeles', locale: 'en-US' })
    try {
      const second = await other.newPage()
      await logInViaUI(second, s.caregiver.email, s.caregiver.password, '**/assignments')
      await expect(cards(second)).toHaveCount(4)
      expect(await listText(second)).toEqual(here)
    } finally {
      await other.close()
    }
  })

  test('TC-VIS-010: every card has a chevron on the date line at the top right and opens Assignment Detail in the state that fits', async ({ page }) => {
    const s = await scenario(`${stamp}b`)
    await logInViaUI(page, s.caregiver.email, s.caregiver.password, '**/assignments')
    const order = [s.names.open, s.names.tomorrow, s.names.soon, s.names.passed]
    const urlOf: Record<string, string> = { [s.names.open]: s.open.id, [s.names.tomorrow]: s.tomorrowCard.id, [s.names.soon]: s.soon.id, [s.names.passed]: s.passed.id }

    for (const name of order) {
      const card = cardOf(page, name)
      const box = (await card.boundingBox())!
      expect(box.height, `${name} is at least 44px high`).toBeGreaterThanOrEqual(44)
      // the chevron: the right half of the card, above the second line
      const chevron = (await card.getByTestId('card-chevron').boundingBox())!
      expect(chevron.x, `${name} chevron is in the right half`).toBeGreaterThan(box.x + box.width / 2)
      const second = (await card.getByText(name).boundingBox())!
      expect(chevron.y + chevron.height, `${name} chevron is on the date line, above the second line`).toBeLessThanOrEqual(second.y + 2)
    }

    // a tap on the recipient's name (not the chevron) opens the booking; Back returns to the list in the same order
    const before = await listText(page)
    for (const name of order) {
      await cardOf(page, name).getByText(name).click()
      await page.waitForURL(`**/assignments/${urlOf[name]}`)
      await expect(page.getByRole('heading', { name: 'This booking is no longer available to you.' })).toHaveCount(0)
      await page.goBack()
      await page.waitForURL('**/assignments')
      expect(await listText(page)).toEqual(before)
    }
    // the chevron opens it too, and so does Enter on the focused card
    await cardOf(page, s.names.soon).getByTestId('card-chevron').click()
    await page.waitForURL(`**/assignments/${s.soon.id}`)
    await page.goBack()
    await cardOf(page, s.names.passed).getByRole('link').focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(`**/assignments/${s.passed.id}`)

    // each opens the state that fits: P the visit in progress, U1 the before-the-day page, D the day-passed page
    await page.goto(`/assignments/${s.open.id}`)
    await expect(page.getByTestId('tasks-progress')).toBeVisible()
    await expect(page.getByText('In progress', { exact: true }).first()).toBeVisible()
    await page.goto(`/assignments/${s.soon.id}`)
    await expect(page.getByTestId('visit-notice')).toContainText('Check-in opens on the day of the visit')
    await page.goto(`/assignments/${s.passed.id}`)
    await expect(page.getByTestId('visit-notice')).toContainText('The day of this visit has passed, so check-in is no longer offered.')
    // and both bundle lines read the exact strings on Assignment Detail
    await expect(page.getByText(bundleLines.doctors_day_out)).toBeVisible()
  })

  test('fits a phone: no sideways scrolling with the in-progress and the passed-day card', async ({ page }) => {
    const s = await scenario(`${stamp}c`)
    await page.setViewportSize({ width: 360, height: 740 })
    await logInViaUI(page, s.caregiver.email, s.caregiver.password, '**/assignments')
    await expect(cards(page)).toHaveCount(4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    for (const name of [s.names.open, s.names.passed]) {
      expect((await cardOf(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('DEV-063 — the starter set (TC-VIS-011)', () => {
  test.skip(!personasAvailable, 'the starter set is not seeded in this run')

  test.describe('as cg1', () => {
    test.use({ storageState: personaState('cg1') })
    test('B3 then B5, soonest first, and not B7 (completed) or the others', async ({ page }) => {
      await page.goto('/assignments')
      const list = await listText(page)
      expect(list).toHaveLength(2)
      expect(list[0]).toContain('Test Recipient 2A')
      expect(list[0]).toContain('09:00 EAT')
      expect(list[0]).toContain(bundleLines.medicheck)
      expect(list[1]).toContain('Test Recipient 3A')
      expect(list[1]).toContain('14:00 EAT')
      expect(list[1]).toContain(bundleLines.doctors_day_out)
      expect(list.join(' ')).not.toContain('Test Recipient 4A')
      // every card opens its own booking
      for (let index = 0; index < 2; index += 1) {
        await cards(page).nth(index).getByRole('link').click()
        await page.waitForURL(/\/assignments\/[0-9a-f-]{36}$/)
        await expect(page.getByRole('heading', { name: 'This booking is no longer available to you.' })).toHaveCount(0)
        await page.goBack()
      }
    })
  })

  test.describe('as cg2', () => {
    test.use({ storageState: personaState('cg2') })
    test('B6 first as the visit in progress, then B4; B6 shows one of two Required tasks logged and names the other', async ({ page }) => {
      await page.goto('/assignments')
      const list = await listText(page)
      expect(list).toHaveLength(2)
      expect(list[0]).toContain('Test Recipient 4A')
      expect(list[0]).toContain('In progress')
      await expect(cards(page).first().locator('svg[data-icon="clock"]')).toHaveCount(1)
      expect(list[1]).toContain('Test Recipient 2A')
      expect(list[1]).toContain("Doctor's Day Out")
      expect(list[1]).toContain('11:00 EAT')

      await cards(page).first().getByRole('link').click()
      await page.waitForURL(/\/assignments\/[0-9a-f-]{36}$/)
      await expect(page.getByTestId('tasks-progress')).toHaveText('Required tasks logged: 1 of 2. Tap a task to log it.')
      await expect(page.getByTestId('check-out-line')).toContainText('Still to log: Vitals check.')
    })
  })
})
