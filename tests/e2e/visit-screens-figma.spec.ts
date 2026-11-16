import { test, expect, type Page } from '@playwright/test'
import { logInViaUI } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, makeVisit, nairobiTime, nairobiDay, today } from './factories'

// The Caregiver's screens as the frames VIS-01 to VIS-09 of "FD-VERIFY screens" (sections H and I) draw them,
// measured at 390px: the status chips, the tags, the Tasks card, the Log task screen, the dialogs, the summary.
// Colours are the Components variables.

test.use({ viewport: { width: 390, height: 844 } })

const PRIMARY = 'rgb(11, 110, 105)'
const BORDER = 'rgb(123, 135, 148)'
const LINE = 'rgb(217, 222, 228)'
const SURFACE = 'rgb(245, 247, 250)'
const SOFT = 'rgb(227, 244, 242)'
const AMBER = 'rgb(255, 243, 220)'
const INK = 'rgb(31, 41, 51)'
const WHITE = 'rgb(255, 255, 255)'

const css = (locator: ReturnType<Page['locator']>, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property)
const px = async (locator: ReturnType<Page['locator']>, property: string) => parseFloat(await css(locator, property))

async function openVisit(options: { closed?: boolean } = {}) {
  const family = await makeFamily()
  const caregiver = await makeCaregiver({ verified: true })
  const recipient = await makeRecipient({ family, name: `Frame Recipient ${Date.now()}`, careNotes: 'Takes tablets with breakfast.' })
  const booking = await makeBooking({ family, recipient, bundle: 'medicheck', status: 'assigned', caregiver, visit: nairobiDay(today, '09:00') })
  await makeVisit({
    booking,
    caregiver,
    tasks: [{ key: 'Medication assistance', outcome: 'not_done', reason: 'Chose not to take it.' }],
    closed: options.closed,
    visitNote: options.closed ? 'A calm morning.' : undefined,
  })
  return { caregiver, recipient, booking }
}

test.describe('Caregiver screens — the frames VIS-01 to VIS-09', () => {
  test('VIS-01: the in-progress card has the soft chip first with the chevron, a 2px primary border; the others a 1px border', async ({ page }) => {
    const { caregiver, recipient } = await openVisit()
    await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
    const card = page.locator('a[data-group="in-progress"]')
    expect(await px(card, 'border-top-width')).toBe(2)
    expect(await css(card, 'border-top-color')).toBe(PRIMARY)
    expect(await px(card, 'border-top-left-radius')).toBe(14)
    const chip = card.getByText('In progress', { exact: true })
    expect(await css(chip, 'background-color')).toBe(SOFT)
    expect(await css(chip, 'color')).toBe('rgb(11, 95, 90)')
    const chipBox = (await chip.boundingBox())!
    const dateBox = (await card.getByText(/EAT$/).boundingBox())!
    expect(chipBox.y).toBeLessThan(dateBox.y)
    const date = card.getByText(/EAT$/)
    expect(await px(date, 'font-size')).toBe(16)
    expect(await css(date, 'font-weight')).toBe('600')
    expect(await px(card.getByText(recipient.name), 'font-size')).toBe(16)
  })

  test('VIS-06: the soft In progress chip and "Checked in: date, time" above the summary; the Tasks card with tags, chips and chevrons; the bar', async ({ page }) => {
    const { caregiver, booking } = await openVisit()
    await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
    await page.goto(`/assignments/${booking.id}`)

    const chip = page.getByText('In progress', { exact: true })
    expect(await css(chip, 'background-color')).toBe(SOFT)
    const checkedIn = page.getByTestId('checked-in-line')
    await expect(checkedIn).toHaveText(/^Checked in: [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} EAT$/)
    expect(await px(checkedIn, 'font-size')).toBe(15)
    expect(await css(checkedIn, 'font-weight')).toBe('600')
    const summary = page.getByRole('region', { name: 'Booking', exact: true })
    expect((await checkedIn.boundingBox())!.y).toBeLessThan((await summary.boundingBox())!.y)
    expect(await px(summary, 'border-top-left-radius')).toBe(14)

    const tasks = page.getByRole('region', { name: 'Tasks' })
    expect(await css(tasks, 'border-top-color')).toBe(BORDER)
    const rows = tasks.getByTestId('visit-task')
    await expect(rows).toHaveCount(3)
    const required = rows.nth(0).getByText('Required', { exact: true })
    expect(await css(required, 'border-top-color')).toBe(INK)
    expect(await px(required, 'font-size')).toBe(13)
    expect(await css(required, 'font-weight')).toBe('600')
    await expect(rows.nth(0).getByText('Not done', { exact: true })).toBeVisible()
    const notLogged = rows.nth(1).getByText('Not logged yet', { exact: true })
    expect(await css(notLogged, 'background-color')).toBe(AMBER)
    expect(await css(rows.nth(2).getByText('Optional', { exact: true }), 'font-weight')).toBe('400')
    await expect(rows.nth(0).locator('svg').last()).toBeVisible() // the chevron

    const bar = page.getByTestId('check-out-bar')
    expect(await px(bar, 'padding-left')).toBe(20)
    expect(await css(bar, 'border-top-color')).toBe(LINE)
    const button = bar.getByRole('button', { name: 'Check out' })
    await expect(button).toBeDisabled()
    expect((await button.boundingBox())!.height).toBe(48)
    expect((await button.boundingBox())!.width).toBe(350)
  })

  test('VIS-07: Log task, the 22px name, the tag, Outcome buttons 52 high (soft with a 2px line when chosen), the bar with the line and Save', async ({ page }) => {
    const { caregiver, booking } = await openVisit()
    await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
    await page.goto(`/assignments/${booking.id}`)
    await page.getByRole('link', { name: /Vitals check/ }).click()
    await page.waitForURL('**/tasks/vitals_check')

    expect(await px(page.getByRole('heading', { level: 1, name: 'Vitals check' }), 'font-size')).toBe(22)
    await expect(page.locator('main').getByText('Required', { exact: true })).toBeVisible()
    const done = page.getByRole('radio', { name: 'Done', exact: true })
    const notDone = page.getByRole('radio', { name: 'Not done' })
    expect((await done.boundingBox())!.height).toBe(52)
    expect(await px(done, 'border-top-width')).toBe(1)
    await done.click()
    expect(await css(done, 'background-color')).toBe(SOFT)
    expect(await px(done, 'border-top-width')).toBe(2)
    expect(await css(done, 'border-top-color')).toBe(PRIMARY)
    expect(await css(notDone, 'background-color')).toBe(WHITE)

    await expect(page.getByLabel('Readings (required)')).toHaveAttribute('placeholder', 'Type the readings here')
    expect((await page.getByLabel('Readings (required)').boundingBox())!.height).toBeGreaterThanOrEqual(80)
    const save = page.getByRole('button', { name: 'Save' })
    await expect(save).toBeDisabled()
    expect((await save.boundingBox())!.height).toBe(48)
    await expect(page.getByTestId('change-line')).toHaveText('You can change this until you check out.')
  })

  test('VIS-04: the check-in dialog is the small one with the two buttons one under the other', async ({ browser }) => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const recipient = await makeRecipient({ family, name: `Dialog Recipient ${Date.now()}` })
    const booking = await makeBooking({ family, recipient, bundle: 'medicheck', status: 'assigned', caregiver, visit: nairobiTime({ days: 0, hour: 9 }) })
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
    await page.goto(`/assignments/${booking.id}`)
    await page.getByRole('button', { name: 'Check in' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Check in to this visit?' })).toBeVisible()
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(326)
    expect(await px(dialog, 'border-top-left-radius')).toBe(16)
    const confirm = dialog.getByRole('button', { name: 'Check in' })
    const cancel = dialog.getByRole('button', { name: 'Cancel' })
    expect((await confirm.boundingBox())!.y).toBeLessThan((await cancel.boundingBox())!.y)
    expect((await confirm.boundingBox())!.x).toBe((await cancel.boundingBox())!.x)
    expect(await css(confirm, 'background-color')).toBe(PRIMARY)
    await page.context().close()
  })

  test('VIS-09: the summary has the app bar "Visit summary", the Completed chip, the rows, the Tasks card with tags and chips', async ({ page }) => {
    const { caregiver, booking, recipient } = await openVisit({ closed: true })
    await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
    await page.goto(`/assignments/${booking.id}`)

    await expect(page.locator('header')).toHaveText('Visit summary')
    const chip = page.getByText('Completed', { exact: true })
    expect(await css(chip, 'background-color')).toBe(SOFT)
    const rows = page.getByRole('region', { name: 'Visit' })
    await expect(rows.getByText(recipient.name)).toBeVisible()
    expect(await px(rows.getByText('Care recipient'), 'font-size')).toBe(13)
    await expect(rows.getByText('Checked in', { exact: true })).toBeVisible()
    await expect(rows.getByText('Checked out', { exact: true })).toBeVisible()

    const tasks = page.getByTestId('summary-task')
    await expect(tasks.nth(0).getByText('Not done', { exact: true })).toBeVisible()
    await expect(tasks.nth(0)).toContainText('Reason: Chose not to take it.')
    expect(await css(tasks.nth(1).getByText('Done', { exact: true }), 'background-color')).toBe(SOFT)
    await expect(tasks.nth(2).getByText('Not recorded', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Visit note' })).toContainText('A calm morning.')
    const back = page.getByRole('link', { name: 'Back to my assignments' }).last()
    expect(await css(back, 'text-decoration-line')).toBe('underline')
    expect(await css(page.locator('body'), 'background-color')).toBe(WHITE)
    expect(await css(page.getByRole('region', { name: 'Visit note' }), 'border-top-color')).toBe(BORDER)
    expect(SURFACE).toBeTruthy()
  })
})
