import { test, expect, type Page } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI, serviceClient } from './helpers'

// DEV-042: Choose Caregiver (frames VER-07, 07b, 07c): only Verified caregivers,
// each with their other bookings (information only), single selection, the
// current caregiver shown but not selectable, and a line saying how many
// caregivers are not shown and why. Assigning the chosen caregiver is DEV-043.

async function setup(stamp: number) {
  const admin = await createUserWithRole('admin', `Ada ${stamp}`)
  const family = await createUserWithRole('family_member', `Family ${stamp}`)
  const careA = await createUserWithRole('caregiver', `Choose A ${stamp}`)
  const careB = await createUserWithRole('caregiver', `Choose B ${stamp}`)
  const careC = await createUserWithRole('caregiver', `Choose C ${stamp}`)
  const notVerified = await createUserWithRole('caregiver', `Choose D ${stamp}`)
  const removed = await createUserWithRole('caregiver', `Choose E ${stamp}`)
  for (const caregiver of [careA, careB, careC, removed]) {
    await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
  }
  await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: removed.userId, p_note: 'Reference failed' })

  const book = async (label: string, visit: string) => {
    const recipientId = await apiAddRecipient(family.client, family.userId, `${label} ${stamp}`)
    const { data } = await family.client
      .from('bookings')
      .insert({ account_id: family.userId, care_recipient_id: recipientId, bundle_code: 'medicheck', requested_datetime: visit })
      .select('id')
      .single()
    return data!.id as string
  }
  return { admin, careA, careB, careC, notVerified, removed, book }
}

const radio = (page: Page, name: string) => page.getByRole('radio', { name: new RegExp(name) })

test.describe('DEV-042 — Choose Caregiver', () => {
  test('lists only Verified caregivers with their other bookings, one choice at a time', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { admin, careA, book } = await setup(stamp)
    const target = await book('Target', '2030-01-15T06:30:00.000Z')
    // caregiver A already has two other bookings; caregiver B has none
    for (const [label, visit] of [
      ['OtherOne', '2030-02-05T11:00:00.000Z'],
      ['OtherTwo', '2030-02-01T06:30:00.000Z'],
    ]) {
      const id = await book(label, visit)
      await admin.client.rpc('assign_booking', { p_booking_id: id, p_caregiver_id: careA.userId })
    }

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/bookings/${target}`)
    await page.getByRole('link', { name: 'Assign caregiver' }).click()
    await page.waitForURL(`**/admin/bookings/${target}/choose-caregiver`)

    await expect(page.getByRole('heading', { name: 'Choose a caregiver', level: 1 })).toBeVisible()
    await expect(page.getByText(`MediCheck for Target ${stamp} · Tue 15 Jan 2030, 09:30 EAT`)).toBeVisible()

    // only Verified caregivers: C and the others are offered, D (never verified) and E (lost Verified) are not
    await expect(radio(page, `Choose A ${stamp}`)).toBeVisible()
    await expect(radio(page, `Choose B ${stamp}`)).toBeVisible()
    await expect(radio(page, `Choose C ${stamp}`)).toBeVisible()
    await expect(page.getByText(`Choose D ${stamp}`)).toHaveCount(0)
    await expect(page.getByText(`Choose E ${stamp}`)).toHaveCount(0)

    // each shows the Verified badge and their other bookings by date and time, soonest first (information only)
    const cardA = page.locator('label').filter({ hasText: `Choose A ${stamp}` })
    await expect(cardA.getByText('Verified', { exact: true })).toBeVisible()
    await expect(cardA.getByText('Other bookings')).toBeVisible()
    expect(await cardA.getByRole('listitem').allInnerTexts()).toEqual(['Fri 1 Feb 2030, 09:30 EAT', 'Tue 5 Feb 2030, 14:00 EAT'])
    await expect(cardA.getByRole('radio')).toBeEnabled()
    await expect(page.locator('label').filter({ hasText: `Choose B ${stamp}` })).toContainText('No other bookings')

    // the line about caregivers who are not shown (at least D and E; others may exist)
    const line = await page.getByText(/caregivers? (is|are) not shown because they are not Verified\./).innerText()
    const shown = line.match(/^(\d+) caregivers?/)
    expect(Number(shown![1])).toBeGreaterThanOrEqual(2)

    // nothing chosen yet: Continue waits for a choice
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()

    // single selection: choosing B un-chooses A
    await radio(page, `Choose A ${stamp}`).check()
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1)
    await expect(radio(page, `Choose A ${stamp}`)).toBeChecked()
    await radio(page, `Choose B ${stamp}`).check()
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1)
    await expect(radio(page, `Choose B ${stamp}`)).toBeChecked()
    await expect(radio(page, `Choose A ${stamp}`)).not.toBeChecked()

    // a choice has been made: Continue is available (the dialog it opens is DEV-043)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
    await testInfo.attach('choose-caregiver', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })

  test('the current caregiver is shown as Currently assigned and cannot be chosen', async ({ page }) => {
    const stamp = Date.now()
    const { admin, careC, book } = await setup(stamp)
    const booking = await book('Changing', '2030-01-16T06:30:00.000Z')
    await admin.client.rpc('assign_booking', { p_booking_id: booking, p_caregiver_id: careC.userId })

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/bookings/${booking}`)
    await page.getByRole('link', { name: 'Change caregiver' }).click()
    await page.waitForURL(`**/admin/bookings/${booking}/choose-caregiver`)

    const current = page.locator('label').filter({ hasText: `Choose C ${stamp}` })
    await expect(current.getByText('Currently assigned')).toBeVisible()
    await expect(current.getByRole('radio')).toBeDisabled()
    // this booking is not listed among its own caregiver's "other" bookings
    await expect(current).toContainText('No other bookings')
    // everyone else Verified can still be chosen
    await expect(radio(page, `Choose B ${stamp}`)).toBeEnabled()
    await expect(page.getByText('Currently assigned')).toHaveCount(1)
  })

  test('a caregiver who lost Verified is no longer offered, even if they hold this booking', async ({ page }) => {
    const stamp = Date.now()
    const { admin, careA, book } = await setup(stamp)
    const booking = await book('Lost', '2030-01-17T06:30:00.000Z')
    await admin.client.rpc('assign_booking', { p_booking_id: booking, p_caregiver_id: careA.userId })
    await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: careA.userId, p_note: 'Reference failed' })

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/bookings/${booking}/choose-caregiver`)

    // (the closed dialog's hidden text names the booking's caregiver, so look at what is on offer)
    await expect(radio(page, `Choose A ${stamp}`)).toHaveCount(0)
    await expect(page.getByText('Currently assigned')).toHaveCount(0)
    await expect(radio(page, `Choose B ${stamp}`)).toBeEnabled()
  })

  test('a booking that cannot change caregiver says why instead of offering a list', async ({ page }) => {
    const stamp = Date.now()
    const { admin, careA, book } = await setup(stamp)
    const started = await book('Started', '2030-01-18T06:30:00.000Z')
    await admin.client.rpc('assign_booking', { p_booking_id: started, p_caregiver_id: careA.userId })
    await serviceClient().from('bookings').update({ status: 'in_progress' }).eq('id', started)
    const cancelled = await book('Cancelled', '2030-01-19T06:30:00.000Z')
    await serviceClient().from('bookings').update({ status: 'cancelled' }).eq('id', cancelled)

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    await page.goto(`/admin/bookings/${started}/choose-caregiver`)
    await expect(page.getByText("Visit started — caregiver can't be changed here.")).toBeVisible()
    await expect(page.getByRole('radio')).toHaveCount(0)

    await page.goto(`/admin/bookings/${cancelled}/choose-caregiver`)
    await expect(page.getByText("This booking is cancelled, so a caregiver can't be chosen.")).toBeVisible()
    await expect(page.getByRole('radio')).toHaveCount(0)
  })

  test('unknown or malformed ids are not found, and only Admins can open it', async ({ page }) => {
    const stamp = Date.now()
    const { admin, book } = await setup(stamp)
    const booking = await book('Guard', '2030-01-20T06:30:00.000Z')
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    for (const id of ['not-a-uuid', '00000000-0000-0000-0000-00000000dead']) {
      const response = await page.goto(`/admin/bookings/${id}/choose-caregiver`)
      expect(response?.status(), id).toBe(404)
    }

    const family = await createUserWithRole('family_member', 'Not An Admin')
    await page.context().clearCookies()
    await logInViaUI(page, family.email)
    await page.goto(`/admin/bookings/${booking}/choose-caregiver`)
    await expect(page).toHaveURL(/\/recipients/)
  })
})
