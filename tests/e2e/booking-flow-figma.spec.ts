import { test, expect, type Page } from '@playwright/test'
import { logInViaUI, pickSlot } from './helpers'
import { makeFamily, makeRecipient, nairobiDay, nairobiTime, tomorrow } from './factories'
import { nairobiToday } from '../../lib/datetime'

// The Family Member's booking flow as the Figma frames define it (file "Vizazi Care — FD-ACC + FD-VERIFY Wireframes",
// page "FD-ACC screens"): ACC-06 Who is this booking for?, ACC-07 Bundle Selection, ACC-08 and ACC-08b Date/Time
// Selection, ACC-09, 09b, 09c Booking Review, ACC-10 Booking Confirmation, ACC-11 Leave Without Finishing.
// Measured at the frames' own width, 390px. Colours are the Components variables: primary #0b6e69, soft #e3f4f2,
// border #7b8794, line #d9dee4, danger #b42318, dangersoft #feeceb, ink #1f2933, muted #52606d.

test.use({ viewport: { width: 390, height: 844 } })

const PRIMARY = 'rgb(11, 110, 105)'
const SOFT = 'rgb(227, 244, 242)'
const BORDER = 'rgb(123, 135, 148)'
const DANGER = 'rgb(180, 35, 24)'
const DANGER_SOFT = 'rgb(254, 236, 235)'
const INK = 'rgb(31, 41, 51)'
const MUTED = 'rgb(82, 96, 109)'
const WHITE = 'rgb(255, 255, 255)'

const stamp = Date.now()

async function family(names: string[]) {
  const member = await makeFamily()
  const recipients = []
  for (const name of names) recipients.push(await makeRecipient({ family: member, name: `${name} ${stamp}` }))
  return { member, recipients }
}

const bundleLink = (r: { id: string; name: string }) => `/book/bundle?recipientId=${r.id}&recipientName=${encodeURIComponent(r.name)}`
const css = (locator: ReturnType<Page['locator']>, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property)
const px = async (locator: ReturnType<Page['locator']>, property: string) => parseFloat(await css(locator, property))

/** The AppBar of every booking step: white, 56px, line border, a 44×44 back target, "Book care" 18px semibold. */
async function expectAppBar(page: Page) {
  const bar = page.locator('header').first()
  await expect(bar).toHaveText('Book care')
  expect((await bar.boundingBox())!.height).toBe(56)
  expect(await css(bar, 'background-color')).toBe(WHITE)
  const back = page.getByTestId('booking-back')
  const box = (await back.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(await px(bar.getByText('Book care'), 'font-size')).toBe(18)
  expect(await css(bar.getByText('Book care'), 'font-weight')).toBe('600')
}

async function expectTitle(page: Page, text: string) {
  const title = page.getByRole('heading', { level: 1, name: text })
  await expect(title).toBeVisible()
  expect(await px(title, 'font-size')).toBe(24)
  expect(await css(title, 'font-weight')).toBe('700')
  expect(await css(title, 'color')).toBe(INK)
}

async function expectPrimaryButton(button: ReturnType<Page['locator']>) {
  expect((await button.boundingBox())!.height).toBe(48)
  expect(await css(button, 'background-color')).toBe(PRIMARY)
  expect(await css(button, 'color')).toBe(WHITE)
  expect(await px(button, 'border-top-left-radius')).toBe(10)
  expect(await css(button, 'font-weight')).toBe('600')
}

test.describe('ACC-06 — Who is this booking for?', () => {
  test('two recipient options with radios, nobody pre-selected, Continue waits for a choice', async ({ page }) => {
    const { member, recipients } = await family(['Grace', 'Joseph'])
    await logInViaUI(page, member.email, member.password)
    await page.goto('/book/who')
    await expectAppBar(page)
    await expectTitle(page, 'Who is this booking for?')

    const options = page.getByRole('radio')
    await expect(options).toHaveCount(2)
    await expect(options.nth(0)).toHaveText(`Grace ${stamp}`)
    await expect(options.nth(0)).toHaveAttribute('aria-checked', 'false')
    expect(await css(options.nth(0), 'background-color')).toBe(WHITE)
    expect(await css(options.nth(0), 'border-top-color')).toBe(BORDER)
    expect(await px(options.nth(0), 'border-top-width')).toBe(1)
    expect(await px(options.nth(0), 'border-top-left-radius')).toBe(14)
    expect(await px(options.nth(0), 'font-size')).toBeGreaterThan(0)
    const name = options.nth(0).getByRole('heading')
    expect(await px(name, 'font-size')).toBe(18)
    expect(await css(name, 'font-weight')).toBe('600')

    const next = page.getByRole('button', { name: 'Continue' })
    await expect(next).toBeDisabled()

    await options.nth(1).click()
    await expect(options.nth(1)).toHaveAttribute('aria-checked', 'true')
    // selected: soft fill, a 3px primary border, and "Selected" as text with an icon, not colour alone
    expect(await css(options.nth(1), 'background-color')).toBe(SOFT)
    expect(await css(options.nth(1), 'border-top-color')).toBe(PRIMARY)
    expect(await px(options.nth(1), 'border-top-width')).toBe(3)
    await expect(options.nth(1).getByText('Selected', { exact: true })).toBeVisible()
    await expect(options.nth(0).getByText('Selected', { exact: true })).toHaveCount(0)
    await expect(next).toBeEnabled()
    await expectPrimaryButton(next)
    // Continue sits at the bottom of the screen (the spacer of the frame)
    const box = (await next.boundingBox())!
    expect(box.y + box.height).toBeGreaterThan(844 - 40)

    await next.click()
    await page.waitForURL('**/book/bundle')
    await expect(page.getByTestId('bundle-card-medicheck')).toBeVisible()
    expect(recipients).toHaveLength(2)
  })

  test('Back leaves at once, with no warning (nothing is chosen yet)', async ({ page }) => {
    const { member } = await family(['Grace', 'Joseph'])
    await logInViaUI(page, member.email, member.password)
    await page.goto('/book/who')
    await page.getByTestId('booking-back').click()
    await page.waitForURL('**/recipients')
    await expect(page.getByText('Leave without finishing?')).toHaveCount(0)
  })
})

test.describe('ACC-07 — Bundle Selection', () => {
  test('two cards with the frame’s strings, radios, the Selected state, and Continue', async ({ page }) => {
    const { member, recipients } = await family(['Grace'])
    await logInViaUI(page, member.email, member.password)
    await page.goto(bundleLink(recipients[0]))
    await expectAppBar(page)
    await expectTitle(page, 'Choose a care bundle')
    await expect(page.getByText('Each booking covers one visit.', { exact: true })).toBeVisible()
    expect(await css(page.getByText('Each booking covers one visit.', { exact: true }), 'color')).toBe(MUTED)

    const mediCheck = page.getByTestId('bundle-card-medicheck')
    const dayOut = page.getByTestId('bundle-card-doctors_day_out')
    await expect(page.getByRole('radio')).toHaveCount(2)
    const lines = async (card: typeof mediCheck) => (await card.innerText()).split('\n').map((line) => line.trim()).filter(Boolean)
    expect(await lines(mediCheck)).toEqual([
      'MediCheck',
      '3-hour visit at home',
      "What's included in the visit",
      '• Medication assistance',
      '• Vitals check (blood pressure and glucose)',
      '• Companionship',
      '• MediCheck Report in the app',
      'Response times',
      'Emergency response: under 30 minutes. Missed-medication alert: under 15 minutes.',
    ])
    expect(await lines(dayOut)).toEqual([
      "Doctor's Day Out",
      '4–5 hour visit on the day of a medical appointment',
      "What's included in the visit",
      '• Pre-visit preparation',
      '• Transport and escort',
      '• Advocacy and note-taking',
      '• Post-visit Clinic Visit Report in the app',
      'Response times',
      'Emergency response: under 15 minutes. Dedicated hotline.',
    ])
    // no price, no other bundle, and none of the old words (FD-ACC §6.7: no "frequency", no "daily")
    const text = (await page.locator('main').innerText()).toLowerCase()
    expect(text).not.toMatch(/kes|ksh|\$\s?\d|full circle|peace of mind|daily|frequency|single booking|sla/)

    expect(await px(mediCheck.getByRole('heading'), 'font-size')).toBe(20)
    expect(await css(mediCheck.getByRole('heading'), 'font-weight')).toBe('700')
    expect(await px(mediCheck.getByText('3-hour visit at home'), 'font-size')).toBe(15)
    expect(await px(mediCheck.getByText("What's included in the visit"), 'font-size')).toBe(14)
    expect(await css(mediCheck.getByText("What's included in the visit"), 'font-weight')).toBe('600')
    expect(await css(mediCheck.getByText('Emergency response: under 30 minutes.', { exact: false }), 'color')).toBe(MUTED)

    const next = page.getByRole('button', { name: 'Continue' })
    await expect(next).toBeDisabled()
    expect(await css(next, 'background-color')).toBe('rgb(217, 222, 228)') // Button/Disabled: the line colour

    await mediCheck.click()
    await expect(mediCheck).toHaveAttribute('aria-checked', 'true')
    expect(await css(mediCheck, 'background-color')).toBe(SOFT)
    expect(await css(mediCheck, 'border-top-color')).toBe(PRIMARY)
    expect(await px(mediCheck, 'border-top-width')).toBe(3)
    expect(await px(mediCheck, 'border-top-left-radius')).toBe(14)
    expect(await px(mediCheck, 'padding-left')).toBe(16)
    await expect(mediCheck.getByText('Selected', { exact: true })).toBeVisible()
    expect(await css(mediCheck.getByText('Selected', { exact: true }), 'color')).toBe('rgb(11, 95, 90)')
    await expect(dayOut.getByText('Selected', { exact: true })).toHaveCount(0)
    expect(await css(dayOut, 'border-top-color')).toBe(BORDER)

    // choosing the other card moves the selection
    await dayOut.click()
    await expect(dayOut).toHaveAttribute('aria-checked', 'true')
    await expect(mediCheck).toHaveAttribute('aria-checked', 'false')

    await expect(next).toBeEnabled()
    await expectPrimaryButton(next)
    await next.click()
    await page.waitForURL('**/book/datetime')
  })

  test('the keyboard chooses a card: Space and Enter', async ({ page }) => {
    const { member, recipients } = await family(['Grace'])
    await logInViaUI(page, member.email, member.password)
    await page.goto(bundleLink(recipients[0]))
    const mediCheck = page.getByTestId('bundle-card-medicheck')
    await mediCheck.focus()
    await page.keyboard.press('Space')
    await expect(mediCheck).toHaveAttribute('aria-checked', 'true')
    const dayOut = page.getByTestId('bundle-card-doctors_day_out')
    await dayOut.focus()
    await page.keyboard.press('Enter')
    await expect(dayOut).toHaveAttribute('aria-checked', 'true')
  })
})

test.describe('ACC-08 and ACC-08b — Date/Time Selection', () => {
  async function toDateTime(page: Page, bundle: 'medicheck' | 'doctors_day_out') {
    const { member, recipients } = await family(['Grace'])
    await logInViaUI(page, member.email, member.password)
    await page.goto(bundleLink(recipients[0]))
    await page.getByTestId(`bundle-card-${bundle}`).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/book/datetime')
  }

  test('ACC-08 MediCheck: the copy, the calendar, the start times, the chosen moment, the note', async ({ page }) => {
    await toDateTime(page, 'medicheck')
    await expectAppBar(page)
    await expectTitle(page, 'Choose the date and time of the visit')
    await expect(page.getByTestId('datetime-bundle')).toHaveText('MediCheck · 3-hour visit')
    expect(await px(page.getByTestId('datetime-bundle'), 'font-size')).toBe(16)
    await expect(page.getByText('Each booking covers one visit. To book another day, make another booking afterwards.', { exact: true })).toBeVisible()
    await expect(page.getByText('Times are Nairobi time (EAT), where the visit takes place.', { exact: true })).toBeVisible()
    // the line that only ACC-08b has
    await expect(page.getByText('Choose a start time that suits the appointment.')).toHaveCount(0)

    // the calendar: month and year, Monday first, 44×44 month buttons
    const month = page.getByTestId('month-label')
    const today = nairobiToday()
    const shown = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${today.slice(0, 7)}-01T00:00:00Z`))
    await expect(month).toHaveText(shown)
    await expect(page.getByTestId('date-picker').getByText(/^(Mo|Tu|We|Th|Fr|Sa|Su)$/)).toHaveText(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
    for (const name of ['Previous month', 'Next month']) {
      const box = (await page.getByRole('button', { name }).boundingBox())!
      expect(box.width).toBe(44)
      expect(box.height).toBe(44)
    }
    // earlier days are greyed and cannot be chosen; today can
    const todayCell = page.locator(`[data-date="${today}"]`)
    await expect(todayCell).toBeEnabled()
    if (Number(today.slice(8)) > 1) await expect(page.locator(`[data-date="${today.slice(0, 8)}01"]`)).toBeDisabled()

    // start times 08:00 to 16:00 on the hour, three to a row, none chosen
    const times = page.getByRole('radio')
    await expect(times).toHaveText(['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'])
    const first = (await times.nth(0).boundingBox())!
    expect(first.height).toBe(44)
    expect((await times.nth(2).boundingBox())!.y).toBe(first.y)
    expect((await times.nth(3).boundingBox())!.y).toBeGreaterThan(first.y)
    expect(await px(times.nth(0), 'border-top-left-radius')).toBe(10)
    await expect(page.getByText('Start time', { exact: true })).toBeVisible()
    await expect(page.getByTestId('selected-slot')).toHaveCount(0)
    const next = page.getByRole('button', { name: 'Continue' })
    await expect(next).toBeDisabled()

    // a day alone is not enough
    const day = nairobiDay(tomorrow)
    const dayValue = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(day)
    await pickSlot(page, dayValue, '09:00')
    await expect(next).toBeEnabled()

    // the chosen day: a 40px filled circle; the chosen time: filled, with a check as well as the colour
    const chosenDay = page.locator(`[data-date="${dayValue}"]`)
    await expect(chosenDay).toHaveAttribute('aria-pressed', 'true')
    const circle = chosenDay.locator('span')
    expect(await css(circle, 'background-color')).toBe(PRIMARY)
    expect(await css(circle, 'color')).toBe(WHITE)
    expect((await circle.boundingBox())!.width).toBe(40)
    expect(await px(circle, 'border-top-left-radius')).toBeGreaterThanOrEqual(20)
    const chosenTime = page.locator('[data-time="09:00"]')
    await expect(chosenTime).toHaveAttribute('aria-checked', 'true')
    expect(await css(chosenTime, 'background-color')).toBe(PRIMARY)
    expect(await css(chosenTime, 'color')).toBe(WHITE)
    await expect(chosenTime.locator('svg')).toHaveCount(1)
    await expect(page.locator('[data-time="10:00"] svg')).toHaveCount(0)

    // "Selected: Wed 14 Oct 2026, 09:00 EAT" in 16px semibold, then the note
    const { formatDateTime } = await import('../../lib/datetime')
    await expect(page.getByTestId('selected-slot')).toHaveText(`Selected: ${formatDateTime(nairobiTime({ days: tomorrow, hour: 9 }))}`)
    expect(await px(page.getByTestId('selected-slot'), 'font-size')).toBe(16)
    expect(await css(page.getByTestId('selected-slot'), 'font-weight')).toBe('600')
    const note = page.getByText('Choosing a time does not reserve it. Your request is confirmed once Vizazi Care assigns a caregiver.', { exact: true })
    await expect(note).toBeVisible()
    expect(await css(note.locator('..'), 'background-color')).toBe('rgb(245, 247, 250)')
    expect(await px(note.locator('..'), 'border-top-left-radius')).toBe(10)

    await expectPrimaryButton(next)
    await next.click()
    await page.waitForURL('**/book/review')
  })

  test('ACC-08b Doctor’s Day Out: its own bundle line and its extra sentence', async ({ page }) => {
    await toDateTime(page, 'doctors_day_out')
    await expect(page.getByTestId('datetime-bundle')).toHaveText("Doctor's Day Out · 4–5 hour visit")
    await expect(page.getByText('Choose a start time that suits the appointment.', { exact: true })).toBeVisible()
    await expect(page.getByText('Times are Nairobi time (EAT), where the visit takes place.', { exact: true })).toBeVisible()
    await expect(page.getByRole('radio')).toHaveCount(9)
  })

  test('months can be turned forward, and back only as far as this month; going Back from Review keeps the choice', async ({ page }) => {
    await toDateTime(page, 'medicheck')
    const month = page.getByTestId('month-label')
    const first = await month.innerText()
    await expect(page.getByRole('button', { name: 'Previous month' })).toBeDisabled()
    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(month).not.toHaveText(first)
    await expect(page.getByRole('button', { name: 'Previous month' })).toBeEnabled()
    // every day of a later month can be chosen
    await expect(page.locator('[data-date]:disabled')).toHaveCount(0)
    await page.getByRole('button', { name: 'Previous month' }).click()
    await expect(month).toHaveText(first)

    const dayValue = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(nairobiDay(tomorrow))
    await pickSlot(page, dayValue, '14:00')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/book/review')
    await page.getByRole('link', { name: 'Edit date and time' }).click()
    await page.waitForURL('**/book/datetime')
    await expect(page.locator('[data-time="14:00"]')).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator(`[data-date="${dayValue}"]`)).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('ACC-09, ACC-09b, ACC-09c — Booking Review', () => {
  async function toReview(page: Page, name = 'Grace') {
    const { member, recipients } = await family([name])
    await logInViaUI(page, member.email, member.password)
    await page.goto(bundleLink(recipients[0]))
    await page.getByTestId('bundle-card-medicheck').click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/book/datetime')
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(nairobiDay(tomorrow))
    await pickSlot(page, day, '09:00')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/book/review')
    return { member, recipient: recipients[0] }
  }

  test('ACC-09: the summary card with three rows and an Edit on each, the sentence, Submit at the bottom', async ({ page }) => {
    const { recipient } = await toReview(page)
    await expectAppBar(page)
    await expectTitle(page, 'Review your booking request')

    const card = page.getByTestId('booking-summary')
    expect(await css(card, 'border-top-color')).toBe(BORDER)
    expect(await px(card, 'border-top-left-radius')).toBe(14)
    const { formatDateTime } = await import('../../lib/datetime')
    const rows = (await card.innerText()).split('\n').map((line) => line.trim()).filter((line) => line && line !== 'Edit')
    expect(rows).toEqual([
      'Care recipient',
      recipient.name,
      'Care bundle',
      'MediCheck · 3-hour visit',
      'Date and time of the visit',
      formatDateTime(nairobiTime({ days: tomorrow, hour: 9 })),
    ])
    expect(await px(card.getByText('Care recipient'), 'font-size')).toBe(13)
    expect(await css(card.getByText('Care recipient'), 'color')).toBe(MUTED)
    expect(await px(card.getByText('MediCheck · 3-hour visit'), 'font-size')).toBe(16)
    expect(await css(card.getByText('MediCheck · 3-hour visit'), 'font-weight')).toBe('600')

    // Edit: primary, underlined, semibold, at least 44px high, named for its row
    for (const [name, href] of [
      ['Edit care recipient', '/recipients'],
      ['Edit care bundle', '/book/bundle'],
      ['Edit date and time', '/book/datetime'],
    ]) {
      const link = page.getByRole('link', { name })
      await expect(link).toHaveText('Edit')
      await expect(link).toHaveAttribute('href', href)
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      expect(await css(link, 'color')).toBe(PRIMARY)
      expect(await css(link, 'text-decoration-line')).toBe('underline')
      expect(await css(link, 'font-weight')).toBe('600')
    }
    await expect(page.getByText("This is a request for one visit. We'll confirm your caregiver after you submit.", { exact: true })).toBeVisible()
    await expect(page.getByTestId('submit-error')).toHaveCount(0)

    const submit = page.getByTestId('submit-booking')
    await expect(submit).toHaveText('Submit')
    await expectPrimaryButton(submit)
    const box = (await submit.boundingBox())!
    expect(box.y + box.height).toBeGreaterThan(844 - 40)
  })

  test('ACC-09b: "Submitting…" with the button disabled, so it cannot be sent twice', async ({ page }) => {
    await toReview(page)
    await page.route('**/book/review', async (route) => {
      if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    const submit = page.getByTestId('submit-booking')
    await submit.click()
    await expect(submit).toHaveText('Submitting…')
    await expect(submit).toBeDisabled()
    expect(await css(submit, 'background-color')).toBe('rgb(217, 222, 228)')
    await page.waitForURL('**/book/confirmation')
  })

  test('ACC-09c: a failed submit keeps the data, shows the banner, and Submit is available again', async ({ page }) => {
    await toReview(page)
    let first = true
    await page.route('**/book/review', async (route) => {
      if (first && route.request().method() === 'POST') {
        first = false
        await route.abort('failed')
        return
      }
      await route.continue()
    })
    const submit = page.getByTestId('submit-booking')
    await submit.click()
    const banner = page.getByTestId('submit-error')
    await expect(banner).toBeVisible()
    await expect(banner).toHaveText("Couldn't submit — check your connection and try again")
    expect(await css(banner, 'background-color')).toBe(DANGER_SOFT)
    expect(await css(banner, 'border-top-color')).toBe(DANGER)
    expect(await px(banner, 'border-top-left-radius')).toBe(10)
    expect(await css(banner.getByText("Couldn't submit"), 'color')).toBe(DANGER)
    expect(await px(banner.getByText("Couldn't submit"), 'font-size')).toBe(15)
    await expect(banner.locator('svg')).toHaveCount(1) // an icon, not colour alone
    await expect(submit).toBeEnabled()
    await expect(submit).toHaveText('Submit')
    // the data is kept
    await expect(page.getByTestId('booking-summary')).toContainText('MediCheck · 3-hour visit')
    await submit.click()
    await page.waitForURL('**/book/confirmation')
  })
})

test.describe('ACC-10 — Booking Confirmation', () => {
  test('Request received., the line, the summary without Edit, and "View my bookings"; no app bar, no other button', async ({ page }) => {
    const { member, recipients } = await family(['Grace'])
    await logInViaUI(page, member.email, member.password)
    await page.goto(bundleLink(recipients[0]))
    await page.getByTestId('bundle-card-medicheck').click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/book/datetime')
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(nairobiDay(tomorrow))
    await pickSlot(page, day, '09:00')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByTestId('submit-booking').click()
    await page.waitForURL('**/book/confirmation')

    await expect(page.locator('header')).toHaveCount(0)
    await expect(page.getByRole('button')).toHaveCount(0)
    const title = page.getByRole('heading', { level: 1, name: 'Request received.' })
    await expect(title).toBeVisible()
    expect(await px(title, 'font-size')).toBe(24)
    expect(await css(title, 'text-align')).toBe('center')
    const sentence = page.getByText("We'll confirm your caregiver soon.", { exact: true })
    expect(await px(sentence, 'font-size')).toBe(18)
    expect(await css(sentence, 'text-align')).toBe('center')
    expect(await css(sentence, 'color')).toBe(INK)

    // the icon: a 72px soft circle
    const icon = page.locator('div[aria-hidden="true"]').first()
    const iconBox = (await icon.boundingBox())!
    expect(iconBox.width).toBe(72)
    expect(iconBox.height).toBe(72)
    expect(await css(icon, 'background-color')).toBe(SOFT)

    const { formatDateTime } = await import('../../lib/datetime')
    const card = page.getByTestId('booking-summary')
    const rows = (await card.innerText()).split('\n').map((line) => line.trim()).filter(Boolean)
    expect(rows).toEqual([
      'Care recipient',
      recipients[0].name,
      'Care bundle',
      'MediCheck · 3-hour visit',
      'Date and time of the visit',
      formatDateTime(nairobiTime({ days: tomorrow, hour: 9 })),
    ])
    await expect(card.getByRole('link')).toHaveCount(0)

    const link = page.getByRole('link', { name: 'View my bookings' })
    await expect(link).toHaveAttribute('href', '/bookings')
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await css(link, 'color')).toBe(PRIMARY)
    expect(await css(link, 'text-decoration-line')).toBe('underline')
    expect(await css(link, 'font-weight')).toBe('600')
    // the page is white, as the frame is
    expect(await css(page.locator('main'), 'background-color')).toBe(WHITE)
  })
})

test.describe('ACC-11 — Leave Without Finishing', () => {
  test('a 326px panel, 16px radius, the page dimmed; Stay is the filled button, Leave the outlined one, one under the other', async ({ page }) => {
    const { member, recipients } = await family(['Grace'])
    await logInViaUI(page, member.email, member.password)
    await page.goto(bundleLink(recipients[0]))
    await page.getByTestId('bundle-card-medicheck').click()
    await page.getByTestId('booking-back').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const title = dialog.getByRole('heading', { name: 'Leave without finishing?' })
    expect(await px(title, 'font-size')).toBe(20)
    expect(await css(title, 'font-weight')).toBe('700')
    const body = dialog.getByText("Your progress won't be saved.", { exact: true })
    expect(await px(body, 'font-size')).toBe(16)
    expect(await css(body, 'color')).toBe(MUTED)

    const box = (await dialog.boundingBox())!
    expect(box.width).toBe(326)
    expect(await px(dialog, 'border-top-left-radius')).toBe(16)
    expect(await css(dialog, 'background-color')).toBe(WHITE)
    expect(await px(dialog, 'padding-left')).toBe(0)
    const stay = page.getByTestId('leave-modal-stay')
    const leave = page.getByTestId('leave-modal-leave')
    const stayBox = (await stay.boundingBox())!
    const leaveBox = (await leave.boundingBox())!
    expect(stayBox.x - box.x).toBe(20) // 20px panel padding
    expect(stayBox.width).toBe(326 - 40)
    expect(leaveBox.y).toBeGreaterThan(stayBox.y)
    expect(leaveBox.y - (stayBox.y + stayBox.height)).toBe(8)
    await expect(stay).toHaveText('Stay')
    await expect(leave).toHaveText('Leave')
    expect(await css(stay, 'background-color')).toBe(PRIMARY)
    expect(await css(leave, 'background-color')).toBe(WHITE)
    expect(await css(leave, 'color')).toBe(PRIMARY)
    expect(await px(leave, 'border-top-width')).toBe(2)
    expect(await css(leave, 'border-top-color')).toBe(PRIMARY)
    // the dim: ink at 55%
    expect(await dialog.evaluate((el) => getComputedStyle(el, '::backdrop').backgroundColor)).toBe('rgba(31, 41, 51, 0.55)')

    // Escape is Stay; Leave goes to the list and drops the choice
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('bundle-card-medicheck')).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('booking-back').click()
    await leave.click()
    await page.waitForURL('**/recipients')
  })
})
