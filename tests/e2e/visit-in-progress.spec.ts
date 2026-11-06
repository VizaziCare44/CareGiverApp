import { test, expect, type Page } from '@playwright/test'
import { formatTime } from '../../lib/datetime'
import { canCheckOut, requiredProgress, stillToLog, unloggedOptionalName, type VisitTask } from '../../lib/visits/progress'
import { logInViaUI, serviceClient } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, nairobiTime, type TestCaregiver } from './factories'

// DEV-065: Assignment Detail while the visit is in progress (frames VIS-06, VIS-06b, VIS-06c;
// FR-005, FR-009, FR-011; AC-009, AC-015): the status, the Tasks card with each task's state, and
// Check out in the fixed bottom bar, unavailable until every Required task has an outcome.
// Outcomes are written straight to the table with the service role (logging a task is DEV-066),
// the way the screen will find them. The data layer under it is FD-VISIT 7.2 (migration 0020).

type Bundle = 'medicheck' | 'doctors_day_out'

async function startVisit(bundle: Bundle = 'medicheck') {
  const family = await makeFamily()
  const caregiver = await makeCaregiver({ verified: true })
  const recipient = await makeRecipient({ family, name: `Walker ${Date.now()}` })
  const booking = await makeBooking({ family, recipient, bundle, status: 'assigned', caregiver, visit: nairobiTime({ days: 0, hour: 9 }) })
  const started = await caregiver.client.rpc('check_in', { p_booking_id: booking.id })
  expect(started.error).toBeNull()
  return { family, caregiver, recipient, booking, checkedInAt: (started.data as { checked_in_at: string }).checked_in_at }
}

/** Logs a task the way DEV-066 will: a new entry on the visit's task of that name. */
async function log(bookingId: string, name: string, outcome: 'done' | 'not_done', extra: { note?: string; reason?: string } = {}) {
  const svc = serviceClient()
  const visit = await svc.from('visits').select('id, caregiver_id').eq('booking_id', bookingId).single()
  const task = await svc.from('visit_tasks').select('id').eq('visit_id', visit.data!.id).eq('name', name).single()
  const saved = await svc.from('visit_task_entries').insert({
    visit_task_id: task.data!.id,
    logged_by: visit.data!.caregiver_id,
    outcome,
    note: extra.note ?? null,
    reason: outcome === 'not_done' ? (extra.reason ?? 'Could not do it') : null,
    logged_at: new Date().toISOString(),
  })
  expect(saved.error).toBeNull()
}

async function open(page: Page, caregiver: TestCaregiver, bookingId: string) {
  await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
  await page.goto(`/assignments/${bookingId}`)
}

const bar = (page: Page) => page.getByTestId('check-out-bar')
const checkOut = (page: Page) => bar(page).getByRole('button', { name: 'Check out' })

test.describe('DEV-065 — the rules for Check out (no browser)', () => {
  const task = (name: string, required: boolean, outcome: VisitTask['outcome'] = null): VisitTask => ({ task_key: name, name, is_required: required, outcome })

  test('Required tasks logged, what is still to log, and when Check out opens', () => {
    const tasks = [task('Medication assistance', true), task('Vitals check', true), task('Companionship', false)]
    expect(requiredProgress(tasks)).toEqual({ logged: 0, total: 2 })
    expect(stillToLog(tasks)).toEqual(['Medication assistance', 'Vitals check'])
    expect(canCheckOut(tasks)).toBe(false)

    // Not done counts as logged: it has an outcome
    const some = [task('Medication assistance', true, 'not_done'), task('Vitals check', true), task('Companionship', false)]
    expect(requiredProgress(some)).toEqual({ logged: 1, total: 2 })
    expect(stillToLog(some)).toEqual(['Vitals check'])

    const all = [task('Medication assistance', true, 'done'), task('Vitals check', true, 'not_done'), task('Companionship', false)]
    expect(requiredProgress(all)).toEqual({ logged: 2, total: 2 })
    expect(canCheckOut(all)).toBe(true)
    expect(unloggedOptionalName(all)).toBe('Companionship')

    // an Optional task with an outcome is not named; an Optional task alone does not open Check out
    expect(unloggedOptionalName(all.map((t) => (t.is_required ? t : { ...t, outcome: 'done' as const })))).toBeNull()
    expect(canCheckOut([task('Medication assistance', true), task('Companionship', false, 'done')])).toBe(false)
  })
})

test.describe('DEV-065 — Assignment Detail in progress', () => {
  test('VIS-06: the status, the time checked in, the Tasks card, and Check out unavailable with its reason', async ({ page }) => {
    const { caregiver, booking, checkedInAt } = await startVisit()
    await open(page, caregiver, booking.id)

    await expect(page.getByText('In progress', { exact: true })).toBeVisible()
    await expect(page.locator('[data-icon="clock"]').first()).toBeVisible()
    await expect(page.getByTestId('checked-in-line')).toHaveText(`Checked in: ${formatTime(checkedInAt)}`)

    const card = page.getByRole('region', { name: 'Tasks' })
    await expect(card.getByTestId('tasks-progress')).toHaveText('Required tasks logged: 0 of 2. Tap a task to log it.')
    const rows = card.getByTestId('visit-task')
    await expect(rows).toHaveCount(3)
    const expected: Array<[string, string]> = [
      ['Medication assistance', 'Required'],
      ['Vitals check', 'Required'],
      ['Companionship', 'Optional'],
    ]
    for (const [index, [name, kind]] of expected.entries()) {
      const row = rows.nth(index)
      await expect(row).toContainText(name)
      await expect(row).toContainText(kind)
      await expect(row).toContainText('Not logged yet')
      // each row opens its task and is a comfortable tap target
      await expect(row.getByRole('link')).toHaveAttribute('href', new RegExp(`^/assignments/${booking.id}/tasks/[a-z][a-z0-9_]*$`))
      expect((await row.getByRole('link').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }

    // Check out: in the fixed bar, disabled (not hidden), described by the line above it
    await expect(bar(page)).toHaveCSS('position', 'fixed')
    await expect(checkOut(page)).toBeDisabled()
    const line = page.getByTestId('check-out-line')
    await expect(line).toHaveText(
      'Check out is available once every Required task is logged as Done, or as Not done with a reason. Still to log: Medication assistance, Vitals check.',
    )
    await expect(checkOut(page)).toHaveAccessibleDescription(
      'Check out is available once every Required task is logged as Done, or as Not done with a reason. Still to log: Medication assistance, Vitals check.',
    )
    // the line sits above the button
    expect((await line.boundingBox())!.y).toBeLessThan((await checkOut(page).boundingBox())!.y)
    // there is no Check in on a visit already started
    await expect(page.getByTestId('check-in-bar')).toHaveCount(0)
  })

  test('VIS-06b: logging Required tasks moves the count and the list; Not done counts', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await log(booking.id, 'Medication assistance', 'not_done', { reason: 'Refused the tablets' })
    await open(page, caregiver, booking.id)

    const card = page.getByRole('region', { name: 'Tasks' })
    await expect(card.getByTestId('tasks-progress')).toHaveText('Required tasks logged: 1 of 2. Tap a task to log it.')
    await expect(card.getByTestId('visit-task').nth(0)).toContainText('Not done')
    await expect(card.getByTestId('visit-task').nth(1)).toContainText('Not logged yet')
    await expect(page.getByTestId('check-out-line')).toHaveText(
      'Check out is available once every Required task is logged as Done, or as Not done with a reason. Still to log: Vitals check.',
    )
    await expect(checkOut(page)).toBeDisabled()

    // the entry that counts is the latest: changing it to Done moves the row
    await log(booking.id, 'Medication assistance', 'done')
    await page.reload()
    await expect(card.getByTestId('visit-task').nth(0)).toContainText('Done')
    await expect(card.getByTestId('visit-task').nth(0)).not.toContainText('Not done')
  })

  test('VIS-06c: every Required task logged: Check out is available, and the line names the Optional task', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await log(booking.id, 'Medication assistance', 'done')
    await log(booking.id, 'Vitals check', 'not_done', { reason: 'Meter broken' })
    await open(page, caregiver, booking.id)

    await expect(page.getByRole('region', { name: 'Tasks' }).getByTestId('tasks-progress')).toHaveText('Required tasks logged: 2 of 2. Tap a task to log it.')
    await expect(checkOut(page)).toBeEnabled()
    await expect(page.getByTestId('check-out-line')).toHaveText('All Required tasks are logged. Companionship is Optional, so you can check out without it.')
    await expect(checkOut(page)).toHaveAccessibleDescription('All Required tasks are logged. Companionship is Optional, so you can check out without it.')
  })

  test('the line about the Optional task is left out once the Optional task has an outcome', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await log(booking.id, 'Medication assistance', 'done')
    await log(booking.id, 'Vitals check', 'done', { note: '120/80, 6.1' })
    await log(booking.id, 'Companionship', 'done')
    await open(page, caregiver, booking.id)

    await expect(checkOut(page)).toBeEnabled()
    await expect(page.getByTestId('check-out-line')).toHaveCount(0)
    await expect(checkOut(page)).not.toHaveAttribute('aria-describedby', /.+/)
  })

  test('an Optional task alone does not open Check out', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await log(booking.id, 'Companionship', 'done')
    await open(page, caregiver, booking.id)
    await expect(page.getByRole('region', { name: 'Tasks' }).getByTestId('tasks-progress')).toHaveText('Required tasks logged: 0 of 2. Tap a task to log it.')
    await expect(checkOut(page)).toBeDisabled()
  })

  test("Doctor's Day Out: its own tasks, and its one Optional task named", async ({ page }) => {
    const { caregiver, booking } = await startVisit('doctors_day_out')
    await open(page, caregiver, booking.id)
    const card = page.getByRole('region', { name: 'Tasks' })
    await expect(card.getByTestId('visit-task')).toHaveCount(4)
    await expect(card.getByTestId('tasks-progress')).toHaveText('Required tasks logged: 0 of 3. Tap a task to log it.')
    await expect(page.getByTestId('check-out-line')).toContainText('Still to log: Transport and escort, Advocacy and note-taking, Post-visit summary.')

    await log(booking.id, 'Transport and escort', 'done')
    await log(booking.id, 'Advocacy and note-taking', 'done', { note: 'Asked about the dizziness' })
    await log(booking.id, 'Post-visit summary', 'done', { note: 'Seen by Dr Otieno' })
    await page.reload()
    await expect(checkOut(page)).toBeEnabled()
    await expect(page.getByTestId('check-out-line')).toHaveText('All Required tasks are logged. Pre-visit preparation is Optional, so you can check out without it.')
  })

  test('a Caregiver reads only their own visit: another Caregiver sees the one message', async ({ page }) => {
    const { booking } = await startVisit()
    const stranger = await makeCaregiver({ verified: true })
    await open(page, stranger, booking.id)
    await expect(page.getByRole('heading', { name: 'This booking is no longer available to you.' })).toBeVisible()
    await expect(page.getByTestId('visit-task')).toHaveCount(0)
    await expect(bar(page)).toHaveCount(0)
  })

  test('fits a phone: no sideways scrolling, and the last row is not hidden behind the bar', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await page.setViewportSize({ width: 375, height: 700 })
    await open(page, caregiver, booking.id)
    await expect(page.getByRole('region', { name: 'Tasks' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    // scrolled to the end, the last element of the page ends above the bar
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const last = (await page.getByRole('region', { name: 'Tasks' }).boundingBox())!
    const fixed = (await bar(page).boundingBox())!
    expect(last.y + last.height).toBeLessThanOrEqual(fixed.y + 1)
  })
})
