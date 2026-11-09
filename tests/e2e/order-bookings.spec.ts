import { test, expect, type Page } from '@playwright/test'
import { orderBookings } from '../../lib/bookings/order'
import { logInViaUI } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, nairobiDay, today, tomorrow, type TestBooking, type TestCaregiver } from './factories'
import { personaState, personasAvailable } from './personas'

// DEV-078: the order of the family's My Bookings (the pure function orderBookings, §7.3, decision 14 of
// §15) and the In progress and Completed chips (FR-001, FR-013; AC-012; §6.6(c)).

const b = (id: string, status: string, iso: string) => ({ id, status, requested_datetime: iso })
const ids = (list: { id: string }[]) => list.map((x) => x.id)

test.describe('DEV-078 — orderBookings', () => {
  test('an empty list, and a list with no booking in progress', () => {
    expect(orderBookings([])).toEqual([])
    const list = [b('b', 'requested', '2030-01-17T06:00:00.000Z'), b('a', 'assigned', '2030-01-16T06:00:00.000Z'), b('c', 'completed', '2030-01-10T06:00:00.000Z')]
    expect(ids(orderBookings(list))).toEqual(['a', 'b', 'c'])
  })

  test('in progress first, then every booking that is neither in progress nor completed soonest first, then completed newest first', () => {
    const list = [
      b('done-old', 'completed', '2030-01-01T06:00:00.000Z'),
      b('later', 'requested', '2030-01-20T06:00:00.000Z'),
      b('going', 'in_progress', '2030-01-25T06:00:00.000Z'),
      b('done-new', 'completed', '2030-01-12T06:00:00.000Z'),
      b('soon', 'assigned', '2030-01-15T06:00:00.000Z'),
      b('off', 'cancelled', '2030-01-18T06:00:00.000Z'),
    ]
    expect(ids(orderBookings(list))).toEqual(['going', 'soon', 'off', 'later', 'done-new', 'done-old'])
  })

  test('each group on its own: in progress soonest first', () => {
    const list = [b('x', 'in_progress', '2030-01-16T06:00:00.000Z'), b('y', 'in_progress', '2030-01-15T06:00:00.000Z'), b('z', 'in_progress', '2030-01-17T06:00:00.000Z')]
    expect(ids(orderBookings(list))).toEqual(['y', 'x', 'z'])
  })

  test('each group on its own: the rest soonest first, completed newest first', () => {
    expect(ids(orderBookings([b('2', 'cancelled', '2030-01-16T06:00:00.000Z'), b('1', 'requested', '2030-01-15T06:00:00.000Z'), b('3', 'assigned', '2030-01-17T06:00:00.000Z')]))).toEqual(['1', '2', '3'])
    expect(ids(orderBookings([b('1', 'completed', '2030-01-15T06:00:00.000Z'), b('2', 'completed', '2030-01-17T06:00:00.000Z'), b('3', 'completed', '2030-01-16T06:00:00.000Z')]))).toEqual(['2', '3', '1'])
  })

  test('ties are broken by booking id, in every group', () => {
    const t = '2030-01-15T06:00:00.000Z'
    expect(ids(orderBookings([b('c', 'in_progress', t), b('a', 'in_progress', t), b('b', 'in_progress', t)]))).toEqual(['a', 'b', 'c'])
    expect(ids(orderBookings([b('c', 'requested', t), b('a', 'assigned', t), b('b', 'cancelled', t)]))).toEqual(['a', 'b', 'c'])
    expect(ids(orderBookings([b('c', 'completed', t), b('a', 'completed', t), b('b', 'completed', t)]))).toEqual(['a', 'b', 'c'])
  })

  test('two in progress: soonest requested_datetime first, then booking id (decision 14)', () => {
    const list = [b('a', 'in_progress', '2030-01-16T06:00:00.000Z'), b('c', 'in_progress', '2030-01-15T06:00:00.000Z'), b('b', 'in_progress', '2030-01-15T06:00:00.000Z')]
    expect(ids(orderBookings(list))).toEqual(['b', 'c', 'a'])
  })

  test('instants are compared, not text: a time written with another offset sorts by when it is', () => {
    // 09:00 at +03:00 is 06:00 UTC, which is earlier than 08:00 UTC although "09" > "08" as text
    const list = [b('late', 'requested', '2030-01-15T08:00:00.000Z'), b('early', 'requested', '2030-01-15T09:00:00+03:00')]
    expect(ids(orderBookings(list))).toEqual(['early', 'late'])
  })

  test('it does not change the list it is given, and a status it does not know goes with the bookings still to come', () => {
    const list = [b('2', 'completed', '2030-01-15T06:00:00.000Z'), b('1', 'in_progress', '2030-01-16T06:00:00.000Z')]
    const copy = JSON.parse(JSON.stringify(list))
    orderBookings(list)
    expect(list).toEqual(copy)
    expect(ids(orderBookings([b('z', 'completed', '2030-01-15T06:00:00.000Z'), b('y', 'something_new', '2030-01-16T06:00:00.000Z')]))).toEqual(['y', 'z'])
  })
})

const luminance = (rgb: string) => {
  const [r, g, bl] = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}
const contrast = (a: string, c: string) => {
  const [hi, lo] = [luminance(a), luminance(c)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test.describe('DEV-078 — My Bookings on the screen, with factory bookings', () => {
  test.describe.configure({ mode: 'serial' })

  let family: Awaited<ReturnType<typeof makeFamily>>
  let carers: TestCaregiver[]
  const made: Record<string, TestBooking> = {}

  test.beforeAll(async () => {
    family = await makeFamily()
    carers = await Promise.all([1, 2, 3, 4, 5, 6].map(() => makeCaregiver({ verified: true })))
    const tag = Date.now().toString(36)
    const recipient = (name: string) => makeRecipient({ family, name: `${name} ${tag}` })
    // two in progress, the later one made first; today at 14:00 and at 08:00
    made.goingLate = await makeBooking({ family, recipient: await recipient('GoingLate'), status: 'in_progress', caregiver: carers[0], visit: nairobiDay(today, '14:00') })
    made.goingEarly = await makeBooking({ family, recipient: await recipient('GoingEarly'), status: 'in_progress', caregiver: carers[1], visit: nairobiDay(today, '08:00') })
    // still to come: assigned tomorrow, cancelled in 2 days, requested in 3
    made.requested = await makeBooking({ family, recipient: await recipient('Requested'), visit: nairobiDay(3, '09:00') })
    made.cancelled = await makeBooking({ family, recipient: await recipient('Cancelled'), status: 'cancelled', visit: nairobiDay(2, '09:00') })
    made.assigned = await makeBooking({ family, recipient: await recipient('Assigned'), status: 'assigned', caregiver: carers[2], visit: nairobiDay(tomorrow, '09:00') })
    // completed: today at 07:00 and at 11:00
    made.doneOld = await makeBooking({ family, recipient: await recipient('DoneOld'), status: 'completed', caregiver: carers[3], visit: nairobiDay(today, '07:00') })
    made.doneNew = await makeBooking({ family, recipient: await recipient('DoneNew'), status: 'completed', caregiver: carers[4], visit: nairobiDay(today, '11:00') })
  })

  const names = async (page: Page) =>
    (await page.getByRole('listitem').allInnerTexts()).map((text) => text.split('\n')[0].replace(/\s+[a-z0-9]+$/i, '').trim())

  test('in progress first (soonest first), then the bookings still to come soonest first, then completed newest first', async ({ page }) => {
    await logInViaUI(page, family.email, family.password, '**/recipients')
    await page.goto('/bookings')
    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible()
    expect(await names(page)).toEqual(['GoingEarly', 'GoingLate', 'Assigned', 'Cancelled', 'Requested', 'DoneNew', 'DoneOld'])
  })

  test('the In progress chip has the clock icon and the Completed chip the check icon, on every card; the other statuses are unchanged', async ({ page }) => {
    await logInViaUI(page, family.email, family.password, '**/recipients')
    await page.goto('/bookings')
    const card = (name: string) => page.getByRole('listitem').filter({ hasText: name })
    for (const name of ['GoingEarly', 'GoingLate']) {
      await expect(card(name).getByText('In progress', { exact: true })).toBeVisible()
      await expect(card(name).locator('svg[data-icon="clock"]')).toHaveCount(1)
      await expect(card(name).getByText('In progress', { exact: true })).toHaveCSS('background-color', 'rgb(255, 243, 220)')
    }
    for (const name of ['DoneNew', 'DoneOld']) {
      await expect(card(name).getByText('Completed', { exact: true })).toBeVisible()
      await expect(card(name).locator('svg[data-icon="check"]')).toHaveCount(1)
      await expect(card(name).getByText('Completed', { exact: true })).toHaveCSS('background-color', 'rgb(227, 244, 242)')
    }
    // unchanged: Awaiting (amber clock), Caregiver assigned (soft check), Cancelled plain text without an icon
    await expect(card('Requested').getByText('Awaiting caregiver assignment')).toHaveCSS('background-color', 'rgb(255, 243, 220)')
    await expect(card('Assigned').getByText('Caregiver assigned')).toHaveCSS('background-color', 'rgb(227, 244, 242)')
    await expect(card('Cancelled').getByText('Cancelled', { exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(card('Cancelled').locator('svg[data-icon]')).toHaveCount(0)
  })

  test('contrast of both chips is at least 4.5:1, and the words carry the meaning, not the colour alone', async ({ page }) => {
    await logInViaUI(page, family.email, family.password, '**/recipients')
    await page.goto('/bookings')
    for (const [name, words] of [['GoingEarly', 'In progress'], ['DoneNew', 'Completed']] as const) {
      const chip = page.getByRole('listitem').filter({ hasText: name }).getByText(words, { exact: true })
      const colours = await chip.evaluate((e) => ({ color: getComputedStyle(e).color, background: getComputedStyle(e).backgroundColor }))
      expect(contrast(colours.color, colours.background), words).toBeGreaterThanOrEqual(4.5)
      // an icon beside the words, hidden from screen readers because the words say it
      await expect(chip.locator('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('the same two chips are on the Booking Detail summary', async ({ page }) => {
    await logInViaUI(page, family.email, family.password, '**/recipients')
    for (const [booking, words, icon] of [[made.goingEarly, 'In progress', 'clock'], [made.doneNew, 'Completed', 'check']] as const) {
      await page.goto(`/bookings/${booking.id}`)
      const summary = page.getByRole('region', { name: 'Booking' })
      await expect(summary.getByText(words, { exact: true })).toBeVisible()
      await expect(summary.locator(`svg[data-icon="${icon}"]`)).toHaveCount(1)
    }
  })

  test('and they are the Caregiver\'s chips: the same look on the Caregiver\'s screen', async ({ page }) => {
    const family2Chip = async () => {
      await logInViaUI(page, family.email, family.password, '**/recipients')
      await page.goto('/bookings')
      return page.getByRole('listitem').filter({ hasText: 'GoingEarly' }).getByText('In progress', { exact: true }).evaluate((e) => {
        const s = getComputedStyle(e)
        return { bg: s.backgroundColor, color: s.color, size: s.fontSize, radius: s.borderTopLeftRadius }
      })
    }
    const familySide = await family2Chip()
    await page.context().clearCookies()
    await logInViaUI(page, carers[1].email, carers[1].password, '**/assignments')
    await page.goto(`/assignments/${made.goingEarly.id}`)
    const carerSide = await page.getByText('In progress', { exact: true }).first().evaluate((e) => {
      const s = getComputedStyle(e)
      return { bg: s.backgroundColor, color: s.color, size: s.fontSize, radius: s.borderTopLeftRadius }
    })
    expect(familySide).toEqual(carerSide)
  })
})

test.describe('DEV-078 — the seeded starter set (B6 and B7)', () => {
  test.skip(!personasAvailable, 'the starter set is not seeded in this run')

  test.describe('as fm1: two bookings to come, soonest first', () => {
    test.use({ storageState: personaState('fm1') })
    test('B1 (two days out) then B2 (four days out)', async ({ page }) => {
      await page.goto('/bookings')
      const flat = (await page.getByRole('listitem').allInnerTexts()).map((r) => r.replace(/\s+/g, ' '))
      expect(flat).toHaveLength(2)
      expect(flat[0]).toContain('Test Recipient 1A')
      expect(flat[0]).toContain('MediCheck')
      expect(flat[1]).toContain('Test Recipient 1B')
      expect(flat[1]).toContain("Doctor's Day Out")
    })
  })

  test.describe('as fm4: B6 is in progress and first, B7 is completed and last', () => {
    test.use({ storageState: personaState('fm4') })
    test('the In progress chip with the clock icon first, the Completed chip with the check icon last', async ({ page }) => {
      await page.goto('/bookings')
      const cards = page.getByRole('listitem')
      await expect(cards).toHaveCount(2)
      await expect(cards.first().getByText('In progress', { exact: true })).toBeVisible()
      await expect(cards.first().locator('svg[data-icon="clock"]')).toHaveCount(1)
      await expect(cards.last().getByText('Completed', { exact: true })).toBeVisible()
      await expect(cards.last().locator('svg[data-icon="check"]')).toHaveCount(1)
    })
  })

  test.describe('as fm2: B3 then B4, soonest first, both still to come', () => {
    test.use({ storageState: personaState('fm2') })
    test('B3 (09:00) before B4 (11:00) on one day, neither completed', async ({ page }) => {
      await page.goto('/bookings')
      const rows = (await page.getByRole('listitem').allInnerTexts()).map((r) => r.replace(/\s+/g, ' '))
      expect(rows).toHaveLength(2)
      expect(rows[0]).toContain('09:00 EAT')
      expect(rows[0]).toContain('MediCheck')
      expect(rows[1]).toContain('11:00 EAT')
      expect(rows[1]).toContain("Doctor's Day Out")
      expect(rows.some((r) => r.includes('Completed'))).toBe(false)
    })
  })
})
