import { test, expect, type Page } from '@playwright/test'
import { formatDateTime } from '../../lib/datetime'
import { logInViaUI, serviceClient } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, nairobiTime, type TestCaregiver } from './factories'

// DEV-067: the check-out confirmation (VIS-08) and the visit summary (VIS-09); FR-008, FR-010,
// FR-015; AC-010. The data layer under it is FD-VISIT 7.2 and 7.3 (migration 0020).

type Bundle = 'medicheck' | 'doctors_day_out'

async function startVisit(bundle: Bundle = 'medicheck') {
  const family = await makeFamily()
  const caregiver = await makeCaregiver({ verified: true })
  const recipient = await makeRecipient({ family, name: `Leaver ${Date.now()}` })
  const booking = await makeBooking({ family, recipient, bundle, status: 'assigned', caregiver, visit: nairobiTime({ days: 0, hour: 9 }) })
  const started = await caregiver.client.rpc('check_in', { p_booking_id: booking.id })
  expect(started.error).toBeNull()
  return { caregiver, booking, recipient }
}

async function logAs(caregiver: TestCaregiver, bookingId: string, name: string, outcome: 'done' | 'not_done', text?: string) {
  const svc = serviceClient()
  const visit = await svc.from('visits').select('id').eq('booking_id', bookingId).single()
  const task = await svc.from('visit_tasks').select('task_key').eq('visit_id', visit.data!.id).eq('name', name).single()
  const result = await caregiver.client.rpc('log_visit_task', {
    p_booking_id: bookingId,
    p_task_key: task.data!.task_key,
    p_outcome: outcome,
    p_note: outcome === 'done' ? (text ?? null) : null,
    p_reason: outcome === 'not_done' ? (text ?? 'Could not do it') : null,
  })
  expect(result.error).toBeNull()
}

/** Both Required MediCheck tasks logged: Medication assistance Done, Vitals check Done with readings. */
async function logRequired(caregiver: TestCaregiver, bookingId: string) {
  await logAs(caregiver, bookingId, 'Medication assistance', 'done')
  await logAs(caregiver, bookingId, 'Vitals check', 'done', 'BP 120/80, glucose 6.1')
}

async function open(page: Page, caregiver: TestCaregiver, bookingId: string) {
  await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
  await page.goto(`/assignments/${bookingId}`)
}

const bar = (page: Page) => page.getByTestId('check-out-bar')
const dialog = (page: Page) => page.getByRole('dialog')
const barButton = (page: Page) => bar(page).getByRole('button', { name: 'Check out' })
const confirmButton = (page: Page) => dialog(page).getByRole('button', { name: 'Check out', exact: true })

const BODY = `After you check out you can't change the tasks or notes. The family will see this visit as "Completed" and can read the tasks, reasons and notes you recorded.`

async function visitRow(bookingId: string) {
  const { data } = await serviceClient().from('visits').select('id, checked_in_at, checked_out_at, visit_note').eq('booking_id', bookingId).single()
  return data!
}

test.describe('DEV-067 — check-out confirmation (VIS-08)', () => {
  test('the dialog: its question, the exact body line, the Optional task that will show as Not recorded, the note field and the two buttons', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await logRequired(caregiver, booking.id)
    await open(page, caregiver, booking.id)

    await barButton(page).click()
    await expect(dialog(page).getByRole('heading', { name: 'Check out of this visit?' })).toBeVisible()
    await expect(dialog(page).getByText(BODY, { exact: true })).toBeVisible()
    const lines = dialog(page).getByTestId('unrecorded-line')
    await expect(lines).toHaveCount(1)
    await expect(lines.first()).toHaveText('Companionship is Optional and has no outcome. It will show as "Not recorded".')
    await expect(dialog(page).getByLabel('Note about the visit (optional)')).toBeVisible()
    await expect(confirmButton(page)).toBeEnabled()
    await expect(dialog(page).getByRole('button', { name: 'Go back', exact: true })).toBeEnabled()

    // Go back changes nothing
    await dialog(page).getByRole('button', { name: 'Go back', exact: true }).click()
    await expect(dialog(page)).toHaveCount(0)
    expect((await visitRow(booking.id)).checked_out_at).toBeNull()
    await expect(barButton(page)).toBeEnabled()
  })

  test('no Optional line when the Optional task has an outcome', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await logRequired(caregiver, booking.id)
    await logAs(caregiver, booking.id, 'Companionship', 'done', 'Read the paper together')
    await open(page, caregiver, booking.id)
    await barButton(page).click()
    await expect(dialog(page).getByTestId('unrecorded-line')).toHaveCount(0)
  })

  test('Check out stays unavailable while a Required task has no outcome', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await logAs(caregiver, booking.id, 'Medication assistance', 'done')
    await open(page, caregiver, booking.id)
    await expect(barButton(page)).toBeDisabled()
    await expect(dialog(page)).toHaveCount(0)
  })
})

test.describe('DEV-067 — visit summary (VIS-09)', () => {
  test('checking out: the summary shows what was recorded, the times from the app, the note, and nothing else', async ({ page }) => {
    const { caregiver, booking, recipient } = await startVisit()
    await logAs(caregiver, booking.id, 'Medication assistance', 'not_done', 'The tablets were refused')
    await logAs(caregiver, booking.id, 'Vitals check', 'done', 'BP 120/80, glucose 6.1')
    await open(page, caregiver, booking.id)

    await barButton(page).click()
    await dialog(page).getByLabel('Note about the visit (optional)').fill('  Calm morning, family called at ten.  ')
    await confirmButton(page).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Visit summary' })).toBeVisible()
    const row = await visitRow(booking.id)
    expect(row.checked_out_at).not.toBeNull()
    expect(row.visit_note).toBe('Calm morning, family called at ten.')

    await expect(page.getByText('Completed', { exact: true })).toBeVisible()
    await expect(page.locator('[data-icon="check"]').first()).toBeVisible()
    await expect(page.getByTestId('summary-intro')).toHaveText('This is what you recorded. The family can now read the tasks, reasons and notes. The times were set by the app.')

    const visit = page.getByRole('region', { name: 'Visit', exact: true })
    await expect(visit).toContainText(recipient.name)
    await expect(visit).toContainText('MediCheck · 3-hour visit')
    await expect(visit).toContainText('Checked in')
    await expect(visit).toContainText(formatDateTime(row.checked_in_at))
    await expect(visit).toContainText('Checked out')
    await expect(visit).toContainText(formatDateTime(row.checked_out_at!))
    expect(formatDateTime(row.checked_out_at!)).toMatch(/EAT$/)

    const tasks = page.getByTestId('summary-task')
    await expect(tasks).toHaveCount(3)
    await expect(tasks.nth(0)).toContainText('Medication assistance')
    await expect(tasks.nth(0)).toContainText('Required')
    await expect(tasks.nth(0).getByTestId('summary-result')).toHaveText('Not done')
    await expect(tasks.nth(0)).toContainText('Reason: The tablets were refused')
    await expect(tasks.nth(1).getByTestId('summary-result')).toHaveText('Done')
    await expect(tasks.nth(1)).toContainText('BP 120/80, glucose 6.1')
    await expect(tasks.nth(2)).toContainText('Companionship')
    await expect(tasks.nth(2)).toContainText('Optional')
    await expect(tasks.nth(2).getByTestId('summary-result')).toHaveText('Not recorded')

    await expect(page.getByRole('region', { name: 'Visit note' })).toContainText('Calm morning, family called at ten.')

    // only the way back; no score, praise, badge or the word Verified; nothing to edit
    const back = page.getByRole('link', { name: 'Back to my assignments' }).last()
    await expect(back).toHaveAttribute('href', '/assignments')
    const text = (await page.locator('body').innerText()).toLowerCase()
    for (const word of ['verified', 'score', 'great job', 'well done', 'badge', 'congratulations']) expect(text).not.toContain(word)
    await expect(page.locator('main').locator('button, input, textarea, select')).toHaveCount(0)
    await expect(bar(page)).toHaveCount(0)

    // the database: the booking is completed and the visit never changes again
    const status = await serviceClient().from('bookings').select('status').eq('id', booking.id).single()
    expect(status.data!.status).toBe('completed')

    // a reload shows the same summary; the task screen says it is checked out
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Visit summary' })).toBeVisible()
    const taskRow = await serviceClient().from('visit_tasks').select('task_key').eq('visit_id', row.id).eq('name', 'Vitals check').single()
    await page.goto(`/assignments/${booking.id}/tasks/${taskRow.data!.task_key}`)
    await expect(page.getByTestId('already-checked-out')).toBeVisible()
  })

  test('with no note about the visit, the summary has no note section; Doctor\'s Day Out shows its own tasks', async ({ page }) => {
    const { caregiver, booking } = await startVisit('doctors_day_out')
    await logAs(caregiver, booking.id, 'Transport and escort', 'done')
    await logAs(caregiver, booking.id, 'Advocacy and note-taking', 'done', 'Asked about the dizziness')
    await logAs(caregiver, booking.id, 'Post-visit summary', 'done', 'New tablets, review in two weeks')
    await open(page, caregiver, booking.id)
    await barButton(page).click()
    await expect(dialog(page).getByTestId('unrecorded-line')).toHaveText('Pre-visit preparation is Optional and has no outcome. It will show as "Not recorded".')
    await confirmButton(page).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Visit summary' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Visit note' })).toHaveCount(0)
    const tasks = page.getByTestId('summary-task')
    await expect(tasks).toHaveCount(4)
    await expect(tasks.nth(0)).toContainText('Pre-visit preparation')
    await expect(tasks.nth(0).getByTestId('summary-result')).toHaveText('Not recorded')
    await expect(tasks.nth(3)).toContainText('New tablets, review in two weeks')
  })

  test('never linked or listed: My Assignments does not show a finished visit, and only its own Caregiver can open it', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await logRequired(caregiver, booking.id)
    await open(page, caregiver, booking.id)
    await barButton(page).click()
    await confirmButton(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Visit summary' })).toBeVisible()

    await page.getByRole('link', { name: 'Back to my assignments' }).last().click()
    await page.waitForURL('**/assignments')
    await expect(page.getByText('No bookings assigned to you yet.', { exact: false })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View details' })).toHaveCount(0)

    const stranger = await makeCaregiver({ verified: true })
    await page.context().clearCookies()
    await open(page, stranger, booking.id)
    await expect(page.getByRole('heading', { name: 'This booking is no longer available to you.' })).toBeVisible()
    await expect(page.getByText('Visit summary')).toHaveCount(0)
  })
})

test.describe('DEV-067 — when it goes wrong, and the limits', () => {
  test('a double tap on Check out checks out once; a repeat from elsewhere changes nothing', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await logRequired(caregiver, booking.id)
    await open(page, caregiver, booking.id)
    await barButton(page).click()
    await confirmButton(page).dblclick()
    await expect(page.getByRole('heading', { level: 1, name: 'Visit summary' })).toBeVisible()
    const first = await visitRow(booking.id)

    const again = await caregiver.client.rpc('check_out', { p_booking_id: booking.id, p_visit_note: 'A later note' })
    expect(again.error).toBeNull()
    expect((again.data as { changed: boolean }).changed).toBe(false)
    const after = await visitRow(booking.id)
    expect(after.checked_out_at).toBe(first.checked_out_at)
    expect(after.visit_note).toBe(first.visit_note)
  })

  test('the connection drops: the message, what was typed is still there, and the retry checks out once', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await logRequired(caregiver, booking.id)
    await open(page, caregiver, booking.id)
    await barButton(page).click()
    await dialog(page).getByLabel('Note about the visit (optional)').fill('Quiet visit')

    await page.route(`**/assignments/${booking.id}`, (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()))
    await confirmButton(page).click()
    await expect(page.locator('p[role="alert"]')).toHaveText('Not checked out. Check your connection and try again. What you typed is still here.')
    await expect(dialog(page).getByLabel('Note about the visit (optional)')).toHaveValue('Quiet visit')
    expect((await visitRow(booking.id)).checked_out_at).toBeNull()

    await page.unroute(`**/assignments/${booking.id}`)
    await confirmButton(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Visit summary' })).toBeVisible()
    expect((await visitRow(booking.id)).visit_note).toBe('Quiet visit')
  })

  test('the note about the visit: 2,000 characters, never cut; over the limit Check out is unavailable', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await logRequired(caregiver, booking.id)
    await open(page, caregiver, booking.id)
    await barButton(page).click()
    const field = dialog(page).getByLabel('Note about the visit (optional)')

    await field.fill('n'.repeat(2001))
    expect(await field.inputValue()).toHaveLength(2001)
    await expect(dialog(page).getByTestId('too-long-line')).toHaveText('This is too long. The limit is 2,000 characters.')
    await expect(confirmButton(page)).toBeDisabled()

    await field.fill('n'.repeat(2000))
    await expect(dialog(page).getByTestId('too-long-line')).toHaveCount(0)
    await confirmButton(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Visit summary' })).toBeVisible()
    expect((await visitRow(booking.id)).visit_note).toBe('n'.repeat(2000))
  })

  test('a Caregiver who stops being Verified while the dialog is open gets the one message', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await logRequired(caregiver, booking.id)
    await open(page, caregiver, booking.id)
    await barButton(page).click()

    const { factoryAdmin } = await import('./factories')
    const admin = await factoryAdmin()
    const removed = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: caregiver.userId, p_note: 'Reference failed' })
    expect(removed.error).toBeNull()

    await confirmButton(page).click()
    await expect(page.getByRole('heading', { name: 'This booking is no longer available to you.' })).toBeVisible()
    expect((await visitRow(booking.id)).checked_out_at).toBeNull()
  })

  test('fits a phone: no sideways scrolling in the dialog or the summary', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await logRequired(caregiver, booking.id)
    await page.setViewportSize({ width: 375, height: 667 })
    await open(page, caregiver, booking.id)
    await barButton(page).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    await dialog(page).getByLabel('Note about the visit (optional)').fill('A long note '.repeat(40))
    await confirmButton(page).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Visit summary' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})
