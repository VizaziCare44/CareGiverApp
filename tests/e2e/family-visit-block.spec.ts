import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { formatDateTime } from '../../lib/datetime'
import { familyVisitState, readsForBlock, type VisitReads } from '../../lib/visits/family-visit'
import { FAMILY_VISIT } from '../../lib/visits/family-visit-text'
import { logInViaUI, serviceClient } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, type TestBooking, type TestCaregiver, type TestUser } from './factories'
import { getVisit, getVisitTasks } from './visit-helpers'
import { stringsOf } from './source-strings'

// DEV-075: the visit block on the family's Booking Detail (frames FAM-02, FAM-07; FR-001, FR-002,
// FR-010, FR-012; AC-001, AC-009, AC-013, AC-015, AC-016), in the states F1 to F6. The report itself
// (F3) is DEV-076. The data comes from the factories through the real functions; the state table of
// FD-FAMVIS §7.3 was not available, so the states are the ones the ticket names (a DRAFT).

const CONTACT_EMAIL = 'vizazicare@gmail.com'

const block = (page: Page) => page.getByTestId('visit-block')

async function open(page: Page, family: TestUser, bookingId: string) {
  await logInViaUI(page, family.email, family.password, '**/recipients')
  await page.goto(`/bookings/${bookingId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

async function inProgress() {
  const family = await makeFamily()
  const caregiver = await makeCaregiver({ verified: true })
  const recipient = await makeRecipient({ family })
  const booking = await makeBooking({ family, recipient, status: 'in_progress', caregiver })
  return { family, caregiver, booking }
}

async function logRequired(caregiver: TestCaregiver, booking: TestBooking) {
  const tasks = await getVisitTasks(booking.visitId!)
  for (const task of tasks.filter((t) => t.required)) {
    const saved = await caregiver.client.rpc('log_visit_task', { p_task_id: task.id, p_outcome: 'done', p_note: 'Factory: done', p_reason: null })
    expect(saved.error).toBeNull()
  }
}

test.describe('DEV-075 — which state, decided once all the reads have finished', () => {
  const visit = (checkedOut: string | null) => ({ booking_id: 'b', checked_in_at: '2030-01-15T06:30:00.000Z', checked_out_at: checkedOut, visit_note: null })
  const task = { booking_id: 'b', sort_order: 1, name: 'Vitals check', outcome: 'done' as const, logged_at: null, reason: null, note: null }
  const none: VisitReads = { ok: true, visit: null, tasks: [] }

  test('F1 and F6: no visit block before the visit or when cancelled', () => {
    for (const status of ['requested', 'assigned', 'cancelled'] as const) expect(familyVisitState(status, none), status).toBe('none')
    // not even when a read failed: there is nothing to read for these
    expect(familyVisitState('requested', { ok: false, visit: null, tasks: [] })).toBe('none')
  })

  test('F2 in progress, F4 completed with no visit, F3 completed with a closed visit and tasks', () => {
    expect(familyVisitState('in_progress', { ok: true, visit: visit(null), tasks: [] })).toBe('in-progress')
    expect(familyVisitState('completed', none)).toBe('not-available')
    expect(familyVisitState('completed', { ok: true, visit: visit('2030-01-15T08:00:00.000Z'), tasks: [task] })).toBe('report')
  })

  test('F5: a read failed; a completed booking whose visit has no check-out time; a closed visit with no task rows', () => {
    expect(familyVisitState('in_progress', { ok: false, visit: null, tasks: [] })).toBe('error')
    expect(familyVisitState('completed', { ok: false, visit: null, tasks: [] })).toBe('error')
    expect(familyVisitState('completed', { ok: true, visit: visit(null), tasks: [] })).toBe('error')
    expect(familyVisitState('completed', { ok: true, visit: visit('2030-01-15T08:00:00.000Z'), tasks: [] })).toBe('error')
  })

  test('an in-progress booking with no visit row (only test data can make one) shows no block', () => {
    expect(familyVisitState('in_progress', none)).toBe('none')
  })

  test('for a visit in progress only the check-in time is handed to the browser, whatever came back', () => {
    const handed = readsForBlock('in_progress', { ok: true, visit: { ...visit('2030-01-15T08:00:00.000Z'), visit_note: 'secret' }, tasks: [task] })
    expect(handed.visit).toEqual({ booking_id: 'b', checked_in_at: '2030-01-15T06:30:00.000Z', checked_out_at: null, visit_note: null })
    expect(handed.tasks).toEqual([])
  })
})

test.describe('DEV-075 — the words', () => {
  test('the lines the ticket gives are exact', () => {
    expect(FAMILY_VISIT.heading).toBe('Visit')
    expect(FAMILY_VISIT.checkedInAt).toBe('Checked in at')
    expect(FAMILY_VISIT.inProgressLine).toBe('Tasks and notes appear here after your caregiver checks out. Open this page again to see them.')
    expect(FAMILY_VISIT.notAvailable).toBe('The visit report is not available. Please contact Vizazi Care at')
    expect(FAMILY_VISIT.loadError).toBe("Couldn't load the visit report — check your connection and try again.")
    expect(FAMILY_VISIT.tryAgain).toBe('Try again')
    expect(FAMILY_VISIT.trying).toBe('Trying again…')
  })

  test('the words are "checked in" and "checked out": no "arrived", "left", "on site", location or map (quality gate)', () => {
    const source = readFileSync('lib/visits/family-visit-text.ts', 'utf8')
    const strings = stringsOf(source)
    expect(strings).not.toMatch(/\b(arrived|left|on site|on-site|location|map|gps)\b/i)
  })
})

test.describe('DEV-075 — F2: the visit is in progress', () => {
  test('"Visit", "Checked in at" with the time on the next line, and the fixed line; no task, outcome, reason or note', async ({ page }) => {
    const { family, caregiver, booking } = await inProgress()
    const tasks = await getVisitTasks(booking.visitId!)
    const saved = await caregiver.client.rpc('log_visit_task', { p_task_id: tasks.find((t) => t.name === 'Vitals check')!.id, p_outcome: 'done', p_note: 'secret-reading-12345', p_reason: null })
    expect(saved.error).toBeNull()
    const visit = (await getVisit(booking.id))!

    await open(page, family, booking.id)
    await expect(block(page).getByRole('heading', { name: 'Visit' })).toBeVisible()
    await expect(block(page).getByText('Checked in at', { exact: true })).toBeVisible()
    await expect(page.getByTestId('visit-checked-in')).toHaveText(formatDateTime(visit.checked_in_at))
    await expect(block(page)).toContainText('Tasks and notes appear here after your caregiver checks out. Open this page again to see them.')

    // the time is on its own line, below the label
    const label = (await block(page).getByText('Checked in at', { exact: true }).boundingBox())!
    const time = (await page.getByTestId('visit-checked-in').boundingBox())!
    expect(time.y).toBeGreaterThanOrEqual(label.y + label.height - 1)

    const text = await page.locator('body').innerText()
    for (const word of ['secret-reading-12345', 'Vitals check', 'Medication assistance', 'Not done', 'Not recorded', 'Reason']) expect(text, word).not.toContain(word)
    expect(text.toLowerCase()).not.toMatch(/\b(arrived|on site)\b/)
    // the booking summary and the caregiver block stay
    await expect(page.getByRole('region', { name: 'Booking' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Caregiver' })).toBeVisible()
  })

  test('it asks for nothing after it has loaded: no polling, no timer, no realtime (AC-016)', async ({ page }) => {
    const { family, booking } = await inProgress()
    await open(page, family, booking.id)
    await expect(block(page)).toBeVisible()
    await page.waitForLoadState('networkidle')
    const requests: string[] = []
    // (a link prefetch the framework makes by itself is not the page asking for data)
    page.on('request', (request) => {
      if (!request.headers()['next-router-prefetch']) requests.push(`${request.method()} ${request.url()}`)
    })
    await page.waitForTimeout(3000)
    expect(requests).toEqual([])
  })

  test('check-out while the page is open changes nothing until the page is opened again (AC-013)', async ({ page }) => {
    const { family, caregiver, booking } = await inProgress()
    await open(page, family, booking.id)
    await expect(block(page)).toContainText('Tasks and notes appear here')

    await logRequired(caregiver, booking)
    const out = await caregiver.client.rpc('check_out', { p_booking_id: booking.id, p_visit_note: '' })
    expect(out.error).toBeNull()
    await page.waitForTimeout(2500)
    await expect(block(page)).toContainText('Tasks and notes appear here') // not updated by itself

    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('Tasks and notes appear here')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Booking' }).getByText('Completed')).toBeVisible()
    // and going back to the page fetches again too
    await page.goto('/bookings')
    await page.goBack()
    await expect(page.getByText('Tasks and notes appear here')).toHaveCount(0)
  })
})

test.describe('DEV-075 — F4: completed, and no visit at all', () => {
  test('the notice with the address on its own row, at least 44px high and as wide as the notice, and the full stop', async ({ page }) => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const booking = await makeBooking({ family, status: 'assigned', caregiver })
    expect((await serviceClient().from('bookings').update({ status: 'completed' }).eq('id', booking.id)).error).toBeNull()

    await open(page, family, booking.id)
    await expect(page.getByRole('region', { name: 'Booking' })).toContainText('Completed')
    const notice = page.getByTestId('visit-notice')
    await expect(notice).toContainText('The visit report is not available. Please contact Vizazi Care at')
    const link = notice.getByRole('link', { name: CONTACT_EMAIL })
    await expect(link).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`)
    await expect(link).toContainText(`${CONTACT_EMAIL}.`)

    const noticeBox = (await notice.boundingBox())!
    const linkBox = (await link.boundingBox())!
    expect(linkBox.height).toBeGreaterThanOrEqual(44)
    // on its own row, below the sentence, as wide as the notice's text column (the notice has a 1px border,
    // 16px padding, a 20px icon and a 12px gap): the whole of it, to within a pixel
    const sentence = (await notice.getByText('The visit report is not available.').boundingBox())!
    expect(linkBox.y).toBeGreaterThanOrEqual(sentence.y + sentence.height - 1)
    const column = noticeBox.width - 2 - 16 * 2 - 20 - 12
    expect(Math.abs(linkBox.width - column)).toBeLessThanOrEqual(1)
    expect(await getVisit(booking.id)).toBeNull()
  })
})

test.describe('DEV-075 — F5: the visit report cannot be loaded', () => {
  /** completed by hand with the visit still open: no check-out time (decision 15) */
  async function openVisitCompleted() {
    const made = await inProgress()
    expect((await serviceClient().from('bookings').update({ status: 'completed' }).eq('id', made.booking.id)).error).toBeNull()
    return made
  }

  test('a completed booking whose visit has no check-out time: the message and Try again, in place of the visit block only', async ({ page }) => {
    const { family, booking } = await openVisitCompleted()
    await open(page, family, booking.id)
    await expect(block(page)).toContainText("Couldn't load the visit report — check your connection and try again.")
    await expect(block(page).getByRole('button', { name: 'Try again', exact: true })).toBeEnabled()
    // the rest of the page stays
    await expect(page.getByRole('region', { name: 'Booking' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Caregiver' })).toBeVisible()
    // and no raw error or code anywhere
    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/[A-Z]{2,}_[A-Z0-9_]+|PGRST|permission denied|violates|digest/i)
  })

  test('a closed visit with no task rows is the same state', async ({ page }) => {
    const { family, booking } = await inProgress()
    expect((await serviceClient().from('visits').update({ checked_out_at: new Date(Date.now() + 1000).toISOString() }).eq('id', booking.visitId!)).error).toBeNull()
    expect((await serviceClient().from('bookings').update({ status: 'completed' }).eq('id', booking.id)).error).toBeNull()
    await open(page, family, booking.id)
    await expect(block(page)).toContainText("Couldn't load the visit report")
    await expect(block(page).getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  })

  test('Try again: "Trying again…" while it runs and disabled; it repeats only the visit reads; when the data is right the block clears', async ({ page }) => {
    const { family, caregiver, booking } = await openVisitCompleted()
    await open(page, family, booking.id)
    const button = block(page).getByRole('button')
    await expect(button).toHaveText('Try again')

    // the caregiver finishes the visit for real; the family's page does not know yet
    await logRequired(caregiver, booking)
    expect((await caregiver.client.rpc('check_out', { p_booking_id: booking.id, p_visit_note: '' })).error).toBeNull()

    // a delayed request: the button reads "Trying again…", is disabled, and a second tap sends nothing more
    let actions = 0
    await page.route('**/bookings/**', async (route) => {
      if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
        actions += 1
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      await route.continue()
    })
    await button.click()
    await expect(button).toHaveText('Trying again…')
    await expect(button).toBeDisabled()
    await button.click({ force: true }).catch(() => undefined)

    // it repeated only the visit reads: the summary and the caregiver block were not reloaded or changed
    await expect(block(page)).toHaveCount(0)
    expect(actions).toBe(1)
    await expect(page.getByRole('region', { name: 'Booking' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Caregiver' })).toBeVisible()
  })

  test('a request that fails: the same message, no raw error, and the button is there again with what is on the page unchanged', async ({ page }) => {
    const { family, booking } = await openVisitCompleted()
    await open(page, family, booking.id)
    await page.route('**/bookings/**', (route) => (route.request().headers()['next-action'] ? route.abort() : route.continue()))
    const button = block(page).getByRole('button')
    await button.click()
    await expect(button).toHaveText('Try again')
    await expect(button).toBeEnabled()
    await expect(block(page)).toContainText("Couldn't load the visit report — check your connection and try again.")
    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/fetch|failed to|PGRST|digest|NetworkError/i)
  })
})

test.describe('DEV-075 — F1 and F6: no visit block', () => {
  test('before the visit, in progress with no visit row, and cancelled show none', async ({ page }) => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const assigned = await makeBooking({ family, status: 'assigned', caregiver })
    const requested = await makeBooking({ family })
    const cancelled = await makeBooking({ family, status: 'cancelled' })
    await logInViaUI(page, family.email, family.password, '**/recipients')
    for (const booking of [assigned, requested, cancelled]) {
      await page.goto(`/bookings/${booking.id}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(block(page)).toHaveCount(0)
      await expect(page.getByText('Checked in at')).toHaveCount(0)
    }
  })
})

test.describe('DEV-075 — every time ends in "EAT", in Africa/Nairobi and in America/Los_Angeles', () => {
  for (const timezoneId of ['Africa/Nairobi', 'America/Los_Angeles']) {
    test.describe(timezoneId, () => {
      test.use({ timezoneId })

      test('the check-in time reads the same in Nairobi time and ends in EAT', async ({ page }) => {
        const { family, booking } = await inProgress()
        const visit = (await getVisit(booking.id))!
        await open(page, family, booking.id)
        const shown = await page.getByTestId('visit-checked-in').innerText()
        expect(shown).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} EAT$/)
        expect(shown).toBe(formatDateTime(visit.checked_in_at))
      })
    })
  }
})
