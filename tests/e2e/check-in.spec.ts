import { test, expect, type Page } from '@playwright/test'
import { formatDate, formatTime } from '../../lib/datetime'
import { logInViaUI, serviceClient } from './helpers'
import { factoryAdmin, makeBooking, makeCaregiver, makeFamily, makeRecipient, nairobiTime } from './factories'

// DEV-064: Assignment Detail before and at check-in (frames VIS-02, VIS-03, VIS-03b, VIS-04,
// VIS-05, VIS-05b; FR-001 to FR-004, FR-014; AC-001 to AC-003, AC-012). The state comes from
// the server (caregiver_visit), never the device clock. The data layer under it is FD-VISIT 7.2
// (migration 0020, checked against the document on 2026-11-06); these tests check the screen.

const CONTACT_EMAIL = 'vizazicare@gmail.com'
const DAY_PASSED =
  'The day of this visit has passed, so check-in is no longer offered. If you attended this visit, contact Vizazi Care at'

async function setup(options: { days: number; bundle?: 'medicheck' | 'doctors_day_out'; recipientName?: string }) {
  const family = await makeFamily()
  const caregiver = await makeCaregiver({ verified: true })
  const recipient = await makeRecipient({ family, name: options.recipientName ?? `Recipient ${Date.now()}` })
  const booking = await makeBooking({
    family,
    recipient,
    bundle: options.bundle ?? 'medicheck',
    status: 'assigned',
    caregiver,
    visit: nairobiTime({ days: options.days, hour: 9 }),
  })
  return { family, caregiver, recipient, booking }
}

async function open(page: Page, caregiver: { email: string; password: string }, bookingId: string) {
  await logInViaUI(page, caregiver.email, caregiver.password, '**/assignments')
  await page.goto(`/assignments/${bookingId}`)
}

const bar = (page: Page) => page.getByTestId('check-in-bar')
const dialog = (page: Page) => page.getByRole('dialog')

test.describe('DEV-064 — Assignment Detail before and at check-in', () => {
  test('the checklist block is in every state: heading, line, tasks in order with Required or Optional, and the Medication assistance lines', async ({ page }) => {
    const { caregiver, booking } = await setup({ days: 2 })
    await open(page, caregiver, booking.id)

    const checklist = page.getByRole('region', { name: 'Visit checklist' })
    await expect(checklist.getByRole('heading', { name: 'Visit checklist' })).toBeVisible()
    await expect(checklist).toContainText('Required tasks must be logged before you can check out. Each booking is one visit.')
    const tasks = checklist.getByTestId('checklist-task')
    await expect(tasks).toHaveCount(3)
    await expect(tasks.nth(0)).toContainText('Medication assistance')
    await expect(tasks.nth(0)).toContainText('Required')
    await expect(tasks.nth(1)).toContainText('Vitals check')
    await expect(tasks.nth(1)).toContainText('Required')
    await expect(tasks.nth(2)).toContainText('Companionship')
    await expect(tasks.nth(2)).toContainText('Optional')
    // the description and the if-unsure sentence are under Medication assistance only
    await expect(tasks.nth(0).locator('p')).toHaveCount(2)
    await expect(tasks.nth(1).locator('p')).toHaveCount(0)
    expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('administration')

    // read-only: nothing to press in the checklist
    await expect(checklist.locator('button, input, textarea, select, a')).toHaveCount(0)
  })

  test("Doctor's Day Out lists its own four tasks", async ({ page }) => {
    const { caregiver, booking } = await setup({ days: 2, bundle: 'doctors_day_out' })
    await open(page, caregiver, booking.id)
    const tasks = page.getByRole('region', { name: 'Visit checklist' }).getByTestId('checklist-task')
    await expect(tasks).toHaveCount(4)
    await expect(tasks.nth(0)).toContainText('Pre-visit preparation')
    await expect(tasks.nth(3)).toContainText('Post-visit summary')
  })

  test('VIS-02, before the day: the notice with the date, directly under the summary, and no button at all', async ({ page }) => {
    const { caregiver, booking } = await setup({ days: 2 })
    await open(page, caregiver, booking.id)

    const notice = page.getByTestId('visit-notice')
    await expect(notice).toHaveText(`Check-in opens on the day of the visit, ${formatDate(booking.visit)}.`)

    // order: booking summary, notice, checklist
    const summary = (await page.getByRole('region', { name: 'Booking' }).boundingBox())!
    const noticeBox = (await notice.boundingBox())!
    const checklist = (await page.getByRole('region', { name: 'Visit checklist' }).boundingBox())!
    expect(noticeBox.y).toBeGreaterThanOrEqual(summary.y + summary.height)
    expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(checklist.y)

    await expect(page.getByRole('button', { name: /check in/i })).toHaveCount(0)
    await expect(bar(page)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Go to the visit in progress' })).toHaveCount(0)
  })

  test('VIS-03: on the day, the Check in button is in a bar fixed at the bottom, with no notice', async ({ page }) => {
    const { caregiver, booking } = await setup({ days: 0 })
    await open(page, caregiver, booking.id)

    await expect(bar(page)).toBeVisible()
    await expect(bar(page)).toHaveCSS('position', 'fixed')
    const button = bar(page).getByRole('button', { name: 'Check in' })
    await expect(button).toBeVisible()
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect(page.getByTestId('visit-notice')).toHaveCount(0)
    // the bar sits at the foot of the screen
    const viewport = page.viewportSize()!
    const box = (await bar(page).boundingBox())!
    expect(Math.round(box.y + box.height)).toBe(viewport.height)
  })

  test("VIS-03b: the same for Doctor's Day Out", async ({ page }) => {
    const { caregiver, booking } = await setup({ days: 0, bundle: 'doctors_day_out' })
    await open(page, caregiver, booking.id)
    await expect(bar(page).getByRole('button', { name: 'Check in' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Visit checklist' }).getByTestId('checklist-task')).toHaveCount(4)
  })

  test('VIS-04: the dialog asks first, Cancel changes nothing, Check in checks in and shows the time the server recorded', async ({ page }) => {
    const { caregiver, booking, recipient } = await setup({ days: 0 })
    await open(page, caregiver, booking.id)

    await bar(page).getByRole('button', { name: 'Check in' }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Check in to this visit?' })).toBeVisible()
    // "[Name] · [bundle] · [date]": the bundle name only and the date alone, no clock time (FD-VISIT 6.5, 6.6(k)(c), (j))
    await expect(dialog(page)).toContainText(`${recipient.name} · MediCheck · ${formatDate(booking.visit)}`)
    await expect(dialog(page)).not.toContainText('3-hour')
    await expect(dialog(page)).not.toContainText('EAT')
    await expect(dialog(page)).toContainText('The family will see this visit as "In progress". The check-in time is recorded when you confirm.')
    expect((await dialog(page).getByRole('button', { name: 'Cancel' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog(page)).toHaveCount(0)
    const before = await serviceClient().from('visits').select('id').eq('booking_id', booking.id)
    expect(before.data).toHaveLength(0)

    await bar(page).getByRole('button', { name: 'Check in' }).click()
    await dialog(page).getByRole('button', { name: 'Check in' }).click()

    // the screen now shows the time the server recorded, and offers no second check-in
    const line = page.getByTestId('checked-in-line')
    await expect(line).toBeVisible()
    const { data } = await serviceClient().from('visits').select('id, checked_in_at, caregiver_id').eq('booking_id', booking.id).single()
    expect(data!.caregiver_id).toBe(caregiver.userId)
    await expect(line).toHaveText(`Checked in: ${formatTime(data!.checked_in_at)}`)
    await expect(page.getByRole('button', { name: /check in/i })).toHaveCount(0)
    await expect(bar(page)).toHaveCount(0)

    // what check-in wrote: the booking is in progress and the checklist was copied into the visit
    const status = await serviceClient().from('bookings').select('status').eq('id', booking.id).single()
    expect(status.data!.status).toBe('in_progress')
    const tasks = await serviceClient().from('visit_tasks').select('name, task_key, is_required').eq('visit_id', data!.id).order('sort_order')
    expect(tasks.data!.map((t) => t.name)).toEqual(['Medication assistance', 'Vitals check', 'Companionship'])
    expect(tasks.data!.map((t) => t.task_key)).toEqual(['medication_assistance', 'vitals_check', 'companionship'])
    expect(tasks.data!.map((t) => t.is_required)).toEqual([true, true, false])

    // a reload keeps it
    await page.reload()
    await expect(page.getByTestId('checked-in-line')).toHaveText(`Checked in: ${formatTime(data!.checked_in_at)}`)
  })

  test('a double tap on Check in checks in once', async ({ page }) => {
    const { caregiver, booking } = await setup({ days: 0 })
    await open(page, caregiver, booking.id)
    await bar(page).getByRole('button', { name: 'Check in' }).click()
    await dialog(page).getByRole('button', { name: 'Check in' }).dblclick()
    await expect(page.getByTestId('checked-in-line')).toBeVisible()
    const visits = await serviceClient().from('visits').select('id').eq('booking_id', booking.id)
    expect(visits.data).toHaveLength(1)
  })

  test('VIS-05: another visit in progress: the notice, the link to it, and no Check in button', async ({ page }) => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const first = await makeBooking({ family, recipient: await makeRecipient({ family, name: 'First Recipient' }), status: 'assigned', caregiver, visit: nairobiTime({ days: 0, hour: 8 }) })
    const second = await makeBooking({ family, recipient: await makeRecipient({ family, name: 'Second Recipient' }), bundle: 'doctors_day_out', status: 'assigned', caregiver, visit: nairobiTime({ days: 0, hour: 14 }) })
    const started = await caregiver.client.rpc('check_in', { p_booking_id: first.id })
    expect(started.error).toBeNull()

    await open(page, caregiver, second.id)
    const notice = page.getByTestId('visit-notice')
    await expect(notice).toContainText(
      'You already have a visit in progress (First Recipient, MediCheck). Check out of that visit first, then check in here.',
    )
    const link = notice.getByRole('link', { name: 'Go to the visit in progress' })
    await expect(link).toHaveAttribute('href', `/assignments/${first.id}`)
    // the link is directly under the sentence, inside the notice
    const sentence = (await notice.locator('p').boundingBox())!
    const linkBox = (await link.boundingBox())!
    expect(linkBox.y).toBeGreaterThanOrEqual(sentence.y + sentence.height - 1)
    expect(linkBox.height).toBeGreaterThanOrEqual(44)
    await expect(page.getByRole('button', { name: /check in/i })).toHaveCount(0)
    await expect(bar(page)).toHaveCount(0)

    await link.click()
    await page.waitForURL(`**/assignments/${first.id}`)
    await expect(page.getByTestId('checked-in-line')).toBeVisible()
  })

  test('VIS-05b: the day has passed: the notice, the address on its own row, and no button, bar or link', async ({ page }) => {
    const { caregiver, booking } = await setup({ days: -2 })
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page, caregiver, booking.id)

    const notice = page.getByTestId('visit-notice')
    await expect(notice).toHaveText(`${DAY_PASSED}${CONTACT_EMAIL}.`)
    // the address: an underlined mail link on its own row, at least 44px high, under the sentence
    const mail = notice.getByRole('link', { name: CONTACT_EMAIL })
    await expect(mail).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`)
    const row = (await mail.boundingBox())!
    expect(row.height).toBeGreaterThanOrEqual(44)
    const sentence = (await notice.locator('p').boundingBox())!
    expect(row.y).toBeGreaterThanOrEqual(sentence.y + sentence.height - 1)
    await expect(mail.locator('span').first()).toHaveCSS('text-decoration-line', 'underline')

    // nothing about the visit being late or missed
    const text = (await notice.innerText()).toLowerCase()
    expect(text).not.toMatch(/late|missed|overdue/)
    // no Check in button (not even a disabled one), no bar, no link to a visit
    await expect(page.getByRole('button', { name: /check in/i })).toHaveCount(0)
    await expect(bar(page)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Go to the visit in progress' })).toHaveCount(0)

    // the notice ends inside the first screen (TC-VIS-007)
    const noticeBox = (await notice.boundingBox())!
    expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(844)
    // and the checklist is read-only below it
    await expect(page.getByRole('region', { name: 'Visit checklist' })).toBeVisible()
  })

  test('the server decides the state: NOT_VISIT_DAY reloads the screen into VIS-02', async ({ page }) => {
    const { caregiver, booking } = await setup({ days: 0 })
    await open(page, caregiver, booking.id)
    await expect(bar(page).getByRole('button', { name: 'Check in' })).toBeVisible()

    // the visit is moved to another day while the screen is open
    const moved = await serviceClient().from('bookings').update({ requested_datetime: nairobiTime({ days: 3, hour: 9 }).toISOString() }).eq('id', booking.id)
    expect(moved.error).toBeNull()

    await bar(page).getByRole('button', { name: 'Check in' }).click()
    await dialog(page).getByRole('button', { name: 'Check in' }).click()
    await expect(page.getByTestId('visit-notice')).toContainText('Check-in opens on the day of the visit')
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /check in/i })).toHaveCount(0)
    const visits = await serviceClient().from('visits').select('id').eq('booking_id', booking.id)
    expect(visits.data).toHaveLength(0)
  })

  test('the server decides the state: ANOTHER_VISIT_IN_PROGRESS reloads the screen into VIS-05', async ({ page }) => {
    const family = await makeFamily()
    const caregiver = await makeCaregiver({ verified: true })
    const first = await makeBooking({ family, recipient: await makeRecipient({ family, name: 'Opened Elsewhere' }), status: 'assigned', caregiver, visit: nairobiTime({ days: 0, hour: 8 }) })
    const second = await makeBooking({ family, recipient: await makeRecipient({ family, name: 'Waiting Recipient' }), status: 'assigned', caregiver, visit: nairobiTime({ days: 0, hour: 15 }) })
    await open(page, caregiver, second.id)
    await expect(bar(page).getByRole('button', { name: 'Check in' })).toBeVisible()

    // another visit is opened (on another device) while this screen is open
    const started = await caregiver.client.rpc('check_in', { p_booking_id: first.id })
    expect(started.error).toBeNull()

    await bar(page).getByRole('button', { name: 'Check in' }).click()
    await dialog(page).getByRole('button', { name: 'Check in' }).click()
    await expect(page.getByTestId('visit-notice')).toContainText('You already have a visit in progress (Opened Elsewhere, MediCheck)')
    await expect(page.getByRole('link', { name: 'Go to the visit in progress' })).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
  })

  test('a Caregiver who stops being Verified while the screen is open gets the one message and no visit', async ({ page }) => {
    const { caregiver, booking } = await setup({ days: 0 })
    await open(page, caregiver, booking.id)
    await expect(bar(page).getByRole('button', { name: 'Check in' })).toBeVisible()

    const admin = await factoryAdmin()
    const removed = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: caregiver.userId, p_note: 'Reference failed' })
    expect(removed.error).toBeNull()

    await bar(page).getByRole('button', { name: 'Check in' }).click()
    await dialog(page).getByRole('button', { name: 'Check in' }).click()
    await expect(page.getByRole('heading', { name: 'This booking is no longer available to you.' })).toBeVisible()
    const visits = await serviceClient().from('visits').select('id').eq('booking_id', booking.id)
    expect(visits.data).toHaveLength(0)
  })
})
