import { test, expect, type Page } from '@playwright/test'
import { formatDateTime } from '../../lib/datetime'
import { logInViaUI } from './helpers'
import { nairobiDay, today } from './factories'
import {
  checkInAt,
  exceptionsLocal,
  hours,
  makeExceptionAdmin,
  makeExceptionBooking,
  minutes,
  plus,
  removeVerified,
  setStatus,
  type ExceptionAdmin,
  type ExceptionBooking,
} from './exceptions-data'

// DEV-080 and DEV-081 (FD-ADMINEXC §7, §5; AC-009, AC-011, AC-012, AC-014, AC-016, AC-019; Q5, Q11): the
// Exceptions screen through the browser. Each test has an Admin of its own whose clock row it sets to the
// second (local stack only), and finds its rows by the unique name of the care recipient, because the shared
// database holds other tests' rows too. The companion file FD-ADMINEXC_Test_Cases.md was not supplied, so the
// cases are written from section 5 (the acceptance criteria) and named by them. formatSpan and the strings are
// checked without a browser in admin-exceptions-text.spec.ts.

test.skip(!exceptionsLocal, 'the cases need the test clock, which only the local stack allows; on any other project they are not covered')

const requestedAt = () => nairobiDay(today, '09:00')

let admins: ExceptionAdmin[] = []
async function signedInAdmin(page: Page) {
  const admin = await makeExceptionAdmin()
  admins.push(admin)
  await logInViaUI(page, admin.email, admin.password, '**/admin/queue')
  return admin
}
test.afterEach(async () => {
  await Promise.all(admins.map((admin) => admin.clearNow()))
  admins = []
})

const rowOf = (page: Page, booking: ExceptionBooking) => page.getByTestId('exception-row').filter({ hasText: booking.recipientName })
const cardOf = (page: Page, booking: ExceptionBooking) => page.getByTestId('exception-card').filter({ hasText: booking.recipientName })
const loaded = (page: Page) => page.getByTestId('loaded-line')

async function openScreen(page: Page) {
  await page.goto('/admin/exceptions')
  await expect(loaded(page)).toHaveText(/^Loaded \d\d:\d\d EAT$/)
}

test.describe('DEV-080 — the Exceptions screen (§7)', () => {
  test('the third tab after Caregivers, the title, the line, the load line and Refresh', async ({ page }) => {
    await signedInAdmin(page)
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link')).toHaveText(['Booking Queue', 'Caregivers', 'Exceptions'])
    await nav.getByRole('link', { name: 'Exceptions' }).click()
    await page.waitForURL('**/admin/exceptions')
    await expect(nav.getByRole('link', { name: 'Exceptions' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { level: 1, name: 'Exceptions' })).toBeVisible()
    await expect(page.getByText('Last 7 days. This list sends no alerts.', { exact: true })).toBeVisible()
    await expect(loaded(page)).toHaveText(/^Loaded \d\d:\d\d EAT$/)
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  })

  test('each exception is one chip with its detail line; the row opens Booking Detail; a reason is plain text (AC-014)', async ({ page }) => {
    const admin = await signedInAdmin(page)
    const R = requestedAt()
    const noCheckIn = await makeExceptionBooking({ requested: R })
    const closed = await makeExceptionBooking({ requested: R, bundle: 'doctors_day_out' })
    const unverified = await makeExceptionBooking({ requested: R })
    const missing = await makeExceptionBooking({ requested: R })
    const script = 'Cancelled <script>window.__x=1</script> https://example.test/a?b=c'
    await checkInAt(closed, plus(R, minutes(5)), {
      tasks: [{ key: 'Transport and escort', outcome: 'not_done', reason: `${script}\nSecond line` }],
      closed: true,
      visitNote: 'secret-visit-note',
    })
    await checkInAt(unverified, plus(R, minutes(5)))
    await removeVerified(admin, unverified.caregiver)
    await setStatus(missing.id, 'completed')
    await admin.setNow(plus(R, minutes(31)))

    try {
      await openScreen(page)

      // E1
      const e1 = rowOf(page, noCheckIn)
      await expect(e1.getByTestId('exception-e1')).toContainText('No check-in yet')
      await expect(e1.getByTestId('exception-e1')).toContainText('31 minutes after the requested time')
      await expect(e1).toContainText(formatDateTime(R))
      await expect(e1).toContainText("MediCheck")
      await expect(e1).toContainText(noCheckIn.caregiver.fullName)

      // E4: the task name, then "Reason: ..." as plain characters, line breaks kept, never a note
      const e4 = rowOf(page, closed).getByTestId('exception-e4')
      await expect(e4).toContainText('Required task not done')
      await expect(e4).toContainText('Transport and escort')
      await expect(rowOf(page, closed).getByTestId('exception-reason')).toHaveText(`Reason: ${script}\nSecond line`)
      expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined()
      await expect(page.locator('main script')).toHaveCount(0)
      await expect(rowOf(page, closed).getByTestId('exception-reason')).toHaveCSS('white-space', 'pre-wrap')
      expect(await page.locator('main').innerText()).not.toContain('secret-visit-note')

      // E5, E6
      await expect(rowOf(page, unverified).getByTestId('exception-e5')).toContainText(`${unverified.caregiver.fullName} is not Verified now.`)
      await expect(rowOf(page, missing).getByTestId('exception-e6')).toContainText('Booking status is Completed. No visit record found.')

      // one action per row, named for the recipient and the time; it opens the Admin Booking Detail
      const open = rowOf(page, noCheckIn).getByRole('link', { name: /Open booking/ })
      await expect(open).toHaveCount(1)
      const name = (await open.getAttribute('aria-label'))!
      expect(name).toContain(noCheckIn.recipientName)
      expect(name).toContain(formatDateTime(R))
      await expect(open).toHaveAttribute('href', `/admin/bookings/${noCheckIn.id}`)
      await expect(open).toHaveText('Open booking')
      // the row itself is not a link: one target per row
      await expect(rowOf(page, noCheckIn).getByRole('link')).toHaveCount(1)
      await open.click()
      await page.waitForURL(`**/admin/bookings/${noCheckIn.id}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(noCheckIn.recipientName)
    } finally {
      await setStatus(missing.id, 'assigned')
    }
  })

  test('every span is written as T5, and Refresh repeats the read to the new time (AC-016, AC-012)', async ({ page }) => {
    const admin = await signedInAdmin(page)
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    await admin.setNow(plus(R, minutes(119)))
    await openScreen(page)
    const detail = () => rowOf(page, b).getByTestId('exception-e1')

    await expect(detail()).toContainText('119 minutes after the requested time')
    for (const [offset, words] of [
      [minutes(120), '2 hours'],
      [hours(47), '47 hours'],
      [hours(48), '2 days'],
      [hours(71), '2 days'],
    ] as const) {
      await admin.setNow(plus(R, offset))
      await page.getByRole('button', { name: 'Refresh', exact: true }).click()
      await expect(detail()).toContainText(`${words} after the requested time`)
      await expect(detail()).not.toContainText(/\d+ minutes after/)
    }
  })

  test('a booking with several exceptions is one row with every chip, E1 to E6 in order, and E1 never beside E2 (AC-018)', async ({ page }) => {
    const admin = await signedInAdmin(page)
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    await checkInAt(b, plus(R, minutes(45)))
    await admin.setNow(plus(R, hours(10)))
    await removeVerified(admin, b.caregiver)
    await openScreen(page)

    await expect(rowOf(page, b)).toHaveCount(1)
    const chips = rowOf(page, b).locator('[data-testid^="exception-e"]')
    await expect(chips).toHaveCount(3)
    await expect(chips.nth(0)).toContainText('Checked in late')
    await expect(chips.nth(0)).toContainText('Checked in 45 minutes after the requested time')
    await expect(chips.nth(1)).toContainText('Still in progress')
    await expect(chips.nth(1)).toContainText('Checked in 9 hours ago. No check-out recorded.')
    await expect(chips.nth(2)).toContainText('Caregiver no longer Verified')
    await expect(rowOf(page, b).getByTestId('exception-e1')).toHaveCount(0)
  })

  test('rows are in order of the requested time, oldest first (AC-013)', async ({ page }) => {
    const admin = await signedInAdmin(page)
    const R = requestedAt()
    const late = await makeExceptionBooking({ requested: plus(R, hours(2)) })
    const early = await makeExceptionBooking({ requested: R })
    const middle = await makeExceptionBooking({ requested: plus(R, hours(1)) })
    await admin.setNow(plus(R, hours(5)))
    await openScreen(page)

    const names = await page.getByTestId('exception-row').evaluateAll((rows) => rows.map((row) => row.textContent ?? ''))
    const at = (booking: ExceptionBooking) => names.findIndex((text) => text.includes(booking.recipientName))
    expect([at(early), at(middle), at(late)].every((index) => index >= 0)).toBe(true)
    expect(at(early)).toBeLessThan(at(middle))
    expect(at(middle)).toBeLessThan(at(late))
  })
})

test.describe('DEV-080 — the states (AC-012)', () => {
  test('loading: the words, three placeholders, the load line "Loading…" and Refresh disabled; then the list', async ({ page }) => {
    const admin = await signedInAdmin(page)
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    await admin.setNow(plus(R, minutes(45)))

    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/admin/exceptions', async (route) => {
      if (route.request().method() === 'POST') await held
      await route.continue()
    })
    await page.goto('/admin/exceptions')
    await expect(page.getByText('Loading exceptions…', { exact: true })).toBeVisible()
    await expect(loaded(page)).toHaveText('Loading…')
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled()
    release()
    await expect(loaded(page)).toHaveText(/^Loaded \d\d:\d\d EAT$/)
    await expect(rowOf(page, b)).toHaveCount(1)
  })

  test('empty: the heading and the sentence, with the load line and Refresh kept', async ({ page }) => {
    const admin = await signedInAdmin(page)
    // a clock far ahead puts every booking of the shared database outside the window
    await admin.setNow(new Date(Date.now() + 40 * 365 * 24 * 3600 * 1000))
    await openScreen(page)
    await expect(page.getByRole('heading', { name: 'No exceptions from the last 7 days' })).toBeVisible()
    await expect(page.getByText('None of the situations this screen looks for was found. It says nothing else about the visits.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
    await expect(page.getByTestId('exception-row')).toHaveCount(0)
    await expect(page.getByTestId('exception-card')).toHaveCount(0)
  })

  test('error: one panel, "Not loaded", no Refresh, no code; Try again repeats only the read and shows the list', async ({ page }) => {
    const admin = await signedInAdmin(page)
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    await admin.setNow(plus(R, minutes(45)))

    await page.route('**/admin/exceptions', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()))
    await page.goto('/admin/exceptions')
    await expect(page.getByTestId('exceptions-error')).toContainText("Couldn't load exceptions — check your connection and try again.")
    await expect(loaded(page)).toHaveText('Not loaded')
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0)
    expect(await page.locator('main').innerText()).not.toMatch(/[A-Z]{2,}_[A-Z0-9_]+|PGRST|permission denied|42501/)
    await expect(page.getByTestId('exception-row')).toHaveCount(0)

    await page.unroute('**/admin/exceptions')
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(loaded(page)).toHaveText(/^Loaded \d\d:\d\d EAT$/)
    await expect(rowOf(page, b)).toHaveCount(1)
    await expect(page.getByTestId('exceptions-error')).toHaveCount(0)
  })

  test('a Refresh that fails while rows are on screen: the panel above the old rows, which keep their earlier "Loaded" time', async ({ page }) => {
    const admin = await signedInAdmin(page)
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    await admin.setNow(plus(R, minutes(45)))
    await openScreen(page)
    const before = await loaded(page).innerText()

    await page.route('**/admin/exceptions', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()))
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByTestId('exceptions-error')).toBeVisible()
    await expect(rowOf(page, b)).toHaveCount(1)
    await expect(loaded(page)).toHaveText(before)
    // the panel sits above the rows
    const panel = (await page.getByTestId('exceptions-error').boundingBox())!
    const row = (await rowOf(page, b).boundingBox())!
    expect(panel.y + panel.height).toBeLessThanOrEqual(row.y)
  })

  test('no polling and nothing to change: no request repeats by itself, and the page has no form, no field and only the Refresh button', async ({ page }) => {
    const admin = await signedInAdmin(page)
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    await admin.setNow(plus(R, minutes(45)))
    let posts = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/admin/exceptions')) posts += 1
    })
    await openScreen(page)
    await expect(rowOf(page, b)).toHaveCount(1)
    const after = posts
    await page.waitForTimeout(4000)
    expect(posts, 'no auto-refresh').toBe(after)
    await expect(page.locator('main form, main input, main textarea, main select')).toHaveCount(0)
    await expect(page.locator('main').getByRole('button')).toHaveText(['Refresh'])
  })
})

test.describe('DEV-081 — the screen at the four viewports (AC-019, D1, D2, D6)', () => {
  /** Every text in the list: its size, and its contrast against what is behind it. */
  async function measure(page: Page) {
    return page.evaluate(() => {
      const luminance = (rgb: number[]) => {
        const [r, g, b] = rgb.map((c) => {
          const v = c / 255
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number)
      const backgroundOf = (element: Element): number[] => {
        let node: Element | null = element
        while (node) {
          const bg = parse(getComputedStyle(node).backgroundColor)
          if (bg.length >= 3 && (bg.length === 3 || bg[3] > 0.99)) return bg.slice(0, 3)
          node = node.parentElement
        }
        return [255, 255, 255]
      }
      const section = document.querySelector('section[aria-label="Exceptions list"]')!
      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT)
      const texts: { text: string; size: number; contrast: number; visible: boolean }[] = []
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = (node.textContent ?? '').trim()
        const element = node.parentElement
        if (!text || !element) continue
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
        const fg = parse(style.color).slice(0, 3)
        const bg = backgroundOf(element)
        const l1 = luminance(fg)
        const l2 = luminance(bg)
        texts.push({ text, size: parseFloat(style.fontSize), contrast: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), visible })
      }
      return texts.filter((entry) => entry.visible)
    })
  }

  for (const [width, height, layout] of [
    [1280, 800, 'table'],
    [768, 1024, 'cards'],
    [390, 844, 'cards'],
    [360, 740, 'cards'],
  ] as const) {
    test(`${width} wide: ${layout}, no sideways scroll, every text 16px or more with contrast 4.5:1, the six chips are the shared 16px chip, Open booking is big enough`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      const admin = await signedInAdmin(page)
      const R = requestedAt()
      const long = 'A'.repeat(140)
      // E4 with an unbroken 140-character reason, and E2 + E3 + E5 together on one open visit
      const reasoned = await makeExceptionBooking({ requested: R, bundle: 'doctors_day_out' })
      await checkInAt(reasoned, plus(R, minutes(5)), { tasks: [{ key: 'Transport and escort', outcome: 'not_done', reason: long }], closed: true })
      const everything = await makeExceptionBooking({ requested: R })
      await checkInAt(everything, plus(R, minutes(45)))
      await removeVerified(admin, everything.caregiver)
      const noCheckIn = await makeExceptionBooking({ requested: R })
      const missing = await makeExceptionBooking({ requested: R })
      await setStatus(missing.id, 'completed')
      await admin.setNow(plus(R, hours(10)))

      try {
        await openScreen(page)
        // table from 1024 wide, cards below
        if (layout === 'table') {
          await expect(page.getByTestId('exceptions-table')).toBeVisible()
          await expect(page.getByTestId('exceptions-cards')).toBeHidden()
          await expect(page.getByRole('columnheader')).toHaveText(['Date and time of the visit', 'Care recipient', 'Caregiver', 'Exceptions', 'Action'])
        } else {
          await expect(page.getByTestId('exceptions-cards')).toBeVisible()
          await expect(page.getByTestId('exceptions-table')).toBeHidden()
        }
        const row = layout === 'table' ? rowOf(page, noCheckIn) : cardOf(page, noCheckIn)
        await expect(row).toHaveCount(1)

        // no sideways scroll, even with an unbroken 140-character reason
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, 'no sideways scroll').toBeLessThanOrEqual(0)
        const unit = layout === 'table' ? rowOf(page, everything) : cardOf(page, everything)
        const reasonUnit = layout === 'table' ? rowOf(page, reasoned) : cardOf(page, reasoned)
        const box = (await reasonUnit.boundingBox())!
        const reason = (await reasonUnit.getByTestId('exception-reason').boundingBox())!
        expect(reason.x + reason.width, 'the reason wraps inside its cell or card').toBeLessThanOrEqual(box.x + box.width + 1)

        // every text 16px or more, contrast at least 4.5:1, header and cells included
        const texts = await measure(page)
        expect(texts.length).toBeGreaterThan(10)
        for (const entry of texts) {
          expect(entry.size, `"${entry.text.slice(0, 40)}" is 16px or more`).toBeGreaterThanOrEqual(16)
          expect(entry.contrast, `"${entry.text.slice(0, 40)}" has contrast 4.5:1`).toBeGreaterThanOrEqual(4.5)
        }

        // the six chips are the shared 16px chip: one look, 16px medium text, a 16px icon, hidden from screen readers
        const chip = unit.getByTestId('exception-e5').locator('span').first()
        await expect(chip).toHaveCSS('font-size', '16px')
        await expect(chip).toHaveCSS('font-weight', '500')
        await expect(chip).toHaveCSS('border-top-left-radius', '9999px')
        await expect(chip.locator('svg')).toHaveAttribute('aria-hidden', 'true')
        await expect(chip.locator('svg')).toHaveAttribute('width', '16')

        // Open booking: at least 44px high and wide; 48px high at 390 and 360, button full width of the card
        const open = row.getByRole('link', { name: /Open booking/ })
        const openBox = (await open.boundingBox())!
        expect(openBox.height).toBeGreaterThanOrEqual(44)
        expect(openBox.width).toBeGreaterThanOrEqual(44)
        if (width <= 390) {
          expect(openBox.height).toBeGreaterThanOrEqual(48)
          const card = (await row.boundingBox())!
          expect(openBox.width, 'full width').toBeGreaterThan(card.width - 60)
        }
        const label = (await open.getAttribute('aria-label'))!
        expect(label).toContain(noCheckIn.recipientName)
        expect(label).toContain(formatDateTime(R))

        // the navigation: three tabs, 56px high, on two rows under 768 (the tabs are three equal columns)
        const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link')
        await expect(tabs).toHaveCount(3)
        for (let index = 0; index < 3; index += 1) expect((await tabs.nth(index).boundingBox())!.height).toBeGreaterThanOrEqual(56)
        if (width < 768) {
          const widths = await tabs.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().width)))
          expect(Math.max(...widths) - Math.min(...widths), 'three equal tabs').toBeLessThanOrEqual(2)
        }
      } finally {
        await setStatus(missing.id, 'assigned')
      }
    })
  }
})

test.describe('DEV-081 — time zones (AC-009)', () => {
  test('every time ends in EAT and is the same in a second browser context set to another time zone', async ({ browser, page }) => {
    const admin = await signedInAdmin(page)
    const R = requestedAt()
    const b = await makeExceptionBooking({ requested: R })
    await admin.setNow(plus(R, minutes(45)))

    const read = async (target: Page) => {
      await openScreen(target)
      return { visit: await rowOf(target, b).locator('td').first().innerText(), loaded: await loaded(target).innerText() }
    }
    const here = await read(page)

    const other = await browser.newContext({ timezoneId: 'America/Los_Angeles', locale: 'en-US' })
    try {
      const second = await other.newPage()
      await logInViaUI(second, admin.email, admin.password, '**/admin/queue')
      const there = await read(second)
      expect(there.visit).toBe(here.visit)
      expect(here.visit).toBe(formatDateTime(R))
      expect(here.visit).toMatch(/ EAT$/)
      expect(there.loaded).toMatch(/^Loaded \d\d:\d\d EAT$/)
      expect(here.loaded).toMatch(/^Loaded \d\d:\d\d EAT$/)
    } finally {
      await other.close()
    }
  })
})
