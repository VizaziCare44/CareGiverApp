import { test, expect, type Page } from '@playwright/test'
import { formatTime } from '../../lib/datetime'
import { logInViaUI, serviceClient } from './helpers'
import { makeBooking, makeCaregiver, makeFamily, makeRecipient, nairobiTime, type TestCaregiver } from './factories'

// DEV-066: Log or change a task (frames VIS-07, VIS-07b, VIS-07c, VIS-07d; FR-005 to FR-007,
// FR-013; AC-005 to AC-008, AC-011). The data layer under it is FD-VISIT 7.2 and 7.3 (migration 0020).

type Bundle = 'medicheck' | 'doctors_day_out'

async function startVisit(bundle: Bundle = 'medicheck') {
  const family = await makeFamily()
  const caregiver = await makeCaregiver({ verified: true })
  const recipient = await makeRecipient({ family, name: `Logger ${Date.now()}` })
  const booking = await makeBooking({ family, recipient, bundle, status: 'assigned', caregiver, visit: nairobiTime({ days: 0, hour: 9 }) })
  const started = await caregiver.client.rpc('check_in', { p_booking_id: booking.id })
  expect(started.error).toBeNull()
  return { caregiver, booking }
}

async function taskId(bookingId: string, name: string) {
  const svc = serviceClient()
  const visit = await svc.from('visits').select('id').eq('booking_id', bookingId).single()
  const task = await svc.from('visit_tasks').select('task_key').eq('visit_id', visit.data!.id).eq('name', name).single()
  return task.data!.task_key as string
}

/** Every entry of one task of a booking's visit, oldest first. `task` is the task_key. */
async function entries(bookingId: string, task: string) {
  const svc = serviceClient()
  const visit = await svc.from('visits').select('id').eq('booking_id', bookingId).single()
  const row = await svc.from('visit_tasks').select('id').eq('visit_id', visit.data!.id).eq('task_key', task).single()
  const { data } = await svc.from('visit_task_entries').select('id, outcome, note, reason, logged_at').eq('visit_task_id', row.data!.id).order('id')
  return data ?? []
}

async function openTask(page: Page, caregiver: TestCaregiver, bookingId: string, task: string) {
  await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
  await page.goto(`/assignments/${bookingId}/tasks/${task}`)
}

const done = (page: Page) => page.getByRole('radio', { name: 'Done', exact: true })
const notDone = (page: Page) => page.getByRole('radio', { name: 'Not done', exact: true })
const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true })

test.describe('DEV-066 — Log or change a task', () => {
  test('VIS-07: the title, the task, two equal outcome buttons, and nothing to fill until one is chosen', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await openTask(page, caregiver, booking.id, await taskId(booking.id, 'Companionship'))

    await expect(page.locator('header').getByText('Log task', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Companionship')
    await expect(page.getByText('Optional', { exact: true })).toBeVisible()

    const a = (await done(page).boundingBox())!
    const b = (await notDone(page).boundingBox())!
    expect(Math.abs(a.width - b.width)).toBeLessThan(1) // equal
    expect(Math.abs(a.y - b.y)).toBeLessThan(1) // side by side
    expect(b.x).toBeGreaterThan(a.x + a.width - 1)
    expect(a.height).toBeGreaterThanOrEqual(52) // FD-VISIT TC-VIS-021: each at least 52px high

    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(save(page)).toBeDisabled()
    await expect(page.getByTestId('change-line')).toHaveText('You can change this until you check out.')
    // the line sits above Save
    expect((await page.getByTestId('change-line').boundingBox())!.y).toBeLessThan((await save(page).boundingBox())!.y)
  })

  test('VIS-07b: Medication assistance shows its description and the if-unsure sentence; a note is optional', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    const task = await taskId(booking.id, 'Medication assistance')
    await openTask(page, caregiver, booking.id, task)

    await expect(page.getByTestId('medication-help').locator('p')).toHaveCount(2)
    await done(page).click()
    await expect(page.getByLabel('Note (optional)')).toBeVisible()
    await expect(save(page)).toBeEnabled()
    await expect(page.getByTestId('needed-line')).toHaveCount(0)

    await save(page).click()
    await page.waitForURL(`**/assignments/${booking.id}`)
    await expect(page.getByTestId('tasks-progress')).toHaveText('Required tasks logged: 1 of 2. Tap a task to log it.')
    await expect(page.getByTestId('visit-task').nth(0)).toContainText('Done')
    const saved = await entries(booking.id, task)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ outcome: 'done', note: null, reason: null })
  })

  test('VIS-07c: Readings for Vitals check: its prompt, its line, and Save only once something is written', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    const task = await taskId(booking.id, 'Vitals check')
    await openTask(page, caregiver, booking.id, task)
    await expect(page.getByTestId('medication-help')).toHaveCount(0)

    await done(page).click()
    const field = page.getByLabel('Readings')
    await expect(field).toBeVisible()
    await expect(page.getByText('Type the readings you took, for example blood pressure and glucose.', { exact: true })).toBeVisible()
    await expect(page.getByText('Saving a reading does not alert anyone. If you are worried, phone the Admin or the emergency services.', { exact: true })).toBeVisible()
    // nothing that was a design note
    expect(await page.locator('main').innerText()).not.toContain('No units, ranges, colours or warnings')

    // unavailable until written, with the line that says why: plain text, not an alert
    await expect(save(page)).toBeDisabled()
    const needed = page.getByTestId('needed-line')
    await expect(needed).toHaveText('A note is needed to log this task as Done.')
    await expect(page.locator('p[role="alert"]')).toHaveCount(0)
    await field.fill('   ')
    await expect(save(page)).toBeDisabled()

    await field.fill('BP 120/80, glucose 6.1')
    await expect(needed).toHaveCount(0)
    await expect(save(page)).toBeEnabled()
    await save(page).click()
    await page.waitForURL(`**/assignments/${booking.id}`)

    const saved = await entries(booking.id, task)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ outcome: 'done', note: 'BP 120/80, glucose 6.1', reason: null })
  })

  test('Not done: a reason is always needed, with its line, and a Required task logged Not done counts', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    const task = await taskId(booking.id, 'Medication assistance')
    await openTask(page, caregiver, booking.id, task)

    await notDone(page).click()
    await expect(notDone(page)).toHaveAttribute('aria-checked', 'true')
    const reason = page.getByLabel('Reason (required)')
    await expect(reason).toBeVisible()
    await expect(page.getByTestId('needed-line')).toHaveText('A reason is needed to log this task as Not done.')
    await expect(save(page)).toBeDisabled()

    await reason.fill('The tablets were refused')
    await expect(save(page)).toBeEnabled()
    await save(page).click()
    await page.waitForURL(`**/assignments/${booking.id}`)
    await expect(page.getByTestId('tasks-progress')).toHaveText('Required tasks logged: 1 of 2. Tap a task to log it.')
    await expect(page.getByTestId('visit-task').nth(0)).toContainText('Not done')
    expect((await entries(booking.id, task))[0]).toMatchObject({ outcome: 'not_done', note: null, reason: 'The tablets were refused' })
  })

  test('the limits: 2,000 characters for a note and 500 for a reason; the text is never cut', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    const task = await taskId(booking.id, 'Vitals check')
    await openTask(page, caregiver, booking.id, task)

    await done(page).click()
    const field = page.getByLabel('Readings')
    await field.fill('x'.repeat(2001))
    expect(await field.inputValue()).toHaveLength(2001) // not cut
    await expect(page.getByTestId('too-long-line')).toHaveText('This is too long. The limit is 2,000 characters.')
    await expect(save(page)).toBeDisabled()
    await field.fill('x'.repeat(2000))
    await expect(page.getByTestId('too-long-line')).toHaveCount(0)
    await expect(save(page)).toBeEnabled()

    await notDone(page).click()
    const reason = page.getByLabel('Reason (required)')
    await reason.fill('r'.repeat(501))
    expect(await reason.inputValue()).toHaveLength(501)
    await expect(page.getByTestId('too-long-line')).toHaveText('This is too long. The limit is 500 characters.')
    await expect(save(page)).toBeDisabled()
    await reason.fill('r'.repeat(500))
    await expect(save(page)).toBeEnabled()

    // the 2,000 character note goes through whole
    await done(page).click()
    await save(page).click()
    await page.waitForURL(`**/assignments/${booking.id}`)
    expect((await entries(booking.id, task))[0].note).toBe('x'.repeat(2000))
  })

  test("Doctor's Day Out: Notes and Summary, with their exact prompts", async ({ page }) => {
    const { caregiver, booking } = await startVisit('doctors_day_out')
    await openTask(page, caregiver, booking.id, await taskId(booking.id, 'Advocacy and note-taking'))
    await done(page).click()
    await expect(page.getByLabel('Notes (required)')).toBeVisible()
    await expect(page.getByText('Write down what was discussed or asked at the appointment. The family will read this after you check out.', { exact: true })).toBeVisible()
    await expect(page.getByTestId('needed-line')).toHaveText('A note is needed to log this task as Done.')

    await page.goto(`/assignments/${booking.id}/tasks/${await taskId(booking.id, 'Post-visit summary')}`)
    await done(page).click()
    await expect(page.getByLabel('Summary (required)')).toBeVisible()
    await expect(
      page.getByText("Write down the doctor's instructions, any new prescriptions and the next steps, in plain words. The family will read this after you check out.", { exact: true }),
    ).toBeVisible()

    // a task that needs no note says Note (optional)
    await page.goto(`/assignments/${booking.id}/tasks/${await taskId(booking.id, 'Transport and escort')}`)
    await done(page).click()
    await expect(page.getByLabel('Note (optional)')).toBeVisible()
  })

  test('changing a task: Save change, when it was logged, a new entry, and the earlier one stays', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    const task = await taskId(booking.id, 'Medication assistance')
    const first = await caregiver.client.rpc('log_visit_task', { p_booking_id: booking.id, p_task_key: task, p_outcome: 'done', p_note: 'Gave the morning tablets' })
    expect(first.error).toBeNull()
    await openTask(page, caregiver, booking.id, task)

    // it opens on the entry that counts
    await expect(done(page)).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByLabel('Note (optional)')).toHaveValue('Gave the morning tablets')
    const when = formatTime((await entries(booking.id, task))[0].logged_at)
    await expect(page.getByTestId('change-line')).toHaveText(`Logged as Done on ${when}. You can change it until you check out. The earlier entry stays in the visit record.`)
    await expect(page.getByRole('button', { name: 'Save change', exact: true })).toBeEnabled()
    await expect(save(page)).toHaveCount(0)

    await notDone(page).click()
    await page.getByLabel('Reason (required)').fill('Took it back: it was the wrong tablet')
    await page.getByRole('button', { name: 'Save change', exact: true }).click()
    await page.waitForURL(`**/assignments/${booking.id}`)
    await expect(page.getByTestId('visit-task').nth(0)).toContainText('Not done')

    const all = await entries(booking.id, task)
    expect(all).toHaveLength(2)
    expect(all[0]).toMatchObject({ outcome: 'done', note: 'Gave the morning tablets' })
    expect(all[1]).toMatchObject({ outcome: 'not_done', reason: 'Took it back: it was the wrong tablet' })

    // reopened, it reads the entry that counts now
    await page.goto(`/assignments/${booking.id}/tasks/${task}`)
    await expect(notDone(page)).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('change-line')).toContainText('Logged as Not done on')
  })

  test('VIS-07d: Not saved: the banner, Try again, what was typed is still there, and the retry saves once', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    const task = await taskId(booking.id, 'Vitals check')
    await openTask(page, caregiver, booking.id, task)
    await done(page).click()
    await page.getByLabel('Readings').fill('BP 118/76')

    // the connection drops for the save
    await page.route(`**/assignments/${booking.id}/tasks/${task}`, (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()))
    await save(page).click()
    await expect(page.locator('p[role="alert"]')).toHaveText('Not saved. Check your connection and try again. What you typed is still here.')
    await expect(page.getByLabel('Readings')).toHaveValue('BP 118/76')
    expect(await entries(booking.id, task)).toHaveLength(0)
    const retry = page.getByRole('button', { name: 'Try again', exact: true })
    await expect(retry).toBeEnabled()

    await page.unroute(`**/assignments/${booking.id}/tasks/${task}`)
    await retry.click()
    await page.waitForURL(`**/assignments/${booking.id}`)
    const saved = await entries(booking.id, task)
    expect(saved).toHaveLength(1)
    expect(saved[0].note).toBe('BP 118/76')
  })

  test('a double tap on Save writes one entry', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    const task = await taskId(booking.id, 'Medication assistance')
    await openTask(page, caregiver, booking.id, task)
    await done(page).click()
    await save(page).dblclick()
    await page.waitForURL(`**/assignments/${booking.id}`)
    expect(await entries(booking.id, task)).toHaveLength(1)
  })

  test('after check-out: the already-checked-out message and no edit, on a fresh load and on a screen left open', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    const open = await taskId(booking.id, 'Medication assistance')
    await openTask(page, caregiver, booking.id, open)
    await notDone(page).click()
    await page.getByLabel('Reason (required)').fill('Left open while the visit closed')

    // checked out elsewhere while this screen is open
    const closed = await serviceClient().from('visits').update({ checked_out_at: new Date(Date.now() + 1000).toISOString() }).eq('booking_id', booking.id)
    expect(closed.error).toBeNull()

    await save(page).click()
    const message = 'This visit was already checked out. Refresh to see the current state.'
    await expect(page.getByTestId('already-checked-out')).toContainText(message)
    await expect(page.getByRole('radio')).toHaveCount(0)
    await expect(save(page)).toHaveCount(0)
    expect(await entries(booking.id, open)).toHaveLength(0)

    // and a fresh load says the same, with no controls
    await page.goto(`/assignments/${booking.id}/tasks/${open}`)
    await expect(page.getByTestId('already-checked-out')).toContainText(message)
    await expect(page.getByRole('radio')).toHaveCount(0)
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Back to the assignment' }).first()).toHaveAttribute('href', `/assignments/${booking.id}`)
  })

  test("someone else's task, a made-up task and a malformed id: the one message, or a 404", async ({ page }) => {
    const { booking } = await startVisit()
    const task = await taskId(booking.id, 'Vitals check')
    const stranger = await makeCaregiver({ verified: true })
    await logInViaUI(page, stranger.email, stranger.password, '**/assignments')
    for (const url of [`/assignments/${booking.id}/tasks/${task}`, `/assignments/${booking.id}/tasks/no_such_task`]) {
      await page.goto(url)
      await expect(page.getByRole('heading', { name: 'This booking is no longer available to you.' })).toBeVisible()
      await expect(page.getByRole('radio')).toHaveCount(0)
      expect(await page.locator('body').innerText()).not.toContain('Vitals check')
    }
    expect((await page.goto(`/assignments/${booking.id}/tasks/not-an-id`))!.status()).toBe(404)
  })

  test('a Caregiver who stops being Verified while the screen is open gets the one message on Save', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    const task = await taskId(booking.id, 'Companionship')
    await openTask(page, caregiver, booking.id, task)
    await done(page).click()

    const { factoryAdmin } = await import('./factories')
    const admin = await factoryAdmin()
    const removed = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: caregiver.userId, p_note: 'Reference failed' })
    expect(removed.error).toBeNull()

    await save(page).click()
    await expect(page.getByRole('heading', { name: 'This booking is no longer available to you.' })).toBeVisible()
    expect(await entries(booking.id, task)).toHaveLength(0)
  })

  test('fits a phone: no sideways scrolling, with a long note and the keyboard-sized screen', async ({ page }) => {
    const { caregiver, booking } = await startVisit()
    await page.setViewportSize({ width: 375, height: 667 })
    await openTask(page, caregiver, booking.id, await taskId(booking.id, 'Vitals check'))
    await done(page).click()
    await page.getByLabel('Readings').fill('A long reading '.repeat(60))
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})
