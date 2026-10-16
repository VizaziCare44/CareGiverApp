import { test, expect, type Page } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI, serviceClient } from './helpers'

// DEV-043: the Assign and Change caregiver confirmation dialogs (frames VER-08,
// 08b, 08c, 08d): the consequence text including that the family is not
// notified automatically, "Assigning…" with the button disabled, the conflict
// cases (booking already assigned or no longer assigned; caregiver no longer
// Verified), a lost connection keeping the selection, and on success Booking
// Detail in its new state with a banner.

async function setup(stamp: number) {
  const admin = await createUserWithRole('admin', `Ada ${stamp}`)
  const family = await createUserWithRole('family_member', `Family ${stamp}`)
  const careA = await createUserWithRole('caregiver', `Dialog A ${stamp}`)
  const careB = await createUserWithRole('caregiver', `Dialog B ${stamp}`)
  for (const caregiver of [careA, careB]) {
    await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
  }
  const book = async (label: string) => {
    const recipientId = await apiAddRecipient(family.client, family.userId, `${label} ${stamp}`)
    const { data } = await family.client
      .from('bookings')
      .insert({
        account_id: family.userId,
        care_recipient_id: recipientId,
        bundle_code: 'medicheck',
        requested_datetime: '2030-01-15T06:30:00.000Z',
      })
      .select('id')
      .single()
    return data!.id as string
  }
  return { admin, careA, careB, book }
}

const radio = (page: Page, name: string) => page.getByRole('radio', { name: new RegExp(name) })

async function openChooser(page: Page, adminEmail: string, bookingId: string) {
  await logInViaUI(page, adminEmail, undefined, '**/admin/queue')
  await page.goto(`/admin/bookings/${bookingId}/choose-caregiver`)
}

async function assignments(bookingId: string) {
  const { data } = await serviceClient()
    .from('booking_assignments')
    .select('caregiver_id, previous_caregiver_id')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
  return data
}

test.describe('DEV-043 — Assign and Change caregiver dialogs', () => {
  test('Assign: the consequences, then the booking is assigned and Booking Detail shows a banner', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const { admin, careA, book } = await setup(stamp)
    const bookingId = await book('Assign')
    await openChooser(page, admin.email, bookingId)

    // Continue waits for a choice, then opens the confirmation
    const next = page.getByRole('button', { name: 'Continue' })
    await expect(next).toBeDisabled()
    await radio(page, `Dialog A ${stamp}`).check()
    await next.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: `Assign Dialog A ${stamp} to this booking` })).toBeVisible()
    await expect(dialog.getByText(new RegExp(`Dialog A ${stamp} will see this booking, and the care notes for Assign ${stamp}`))).toBeVisible()
    await expect(dialog.getByText(/The family is not notified automatically/)).toBeVisible()
    await testInfo.attach('assign-dialog', { body: await page.screenshot(), contentType: 'image/png' })

    await dialog.getByRole('button', { name: 'Assign caregiver' }).click()

    // Booking Detail in its new state, with a banner
    await page.waitForURL(`**/admin/bookings/${bookingId}?banner=assigned`)
    await expect(page.getByRole('status').filter({ hasText: 'Caregiver assigned.' })).toBeVisible()
    const block = page.getByRole('region', { name: 'Caregiver' })
    await expect(block.getByText(`Dialog A ${stamp}`)).toBeVisible()
    await expect(block.getByText('Verified', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Change caregiver' })).toBeVisible()

    expect(await assignments(bookingId)).toEqual([{ caregiver_id: careA.userId, previous_caregiver_id: null }])
  })

  test('Change: the old caregiver loses access, and the new one is recorded with who it replaced', async ({ page }) => {
    const stamp = Date.now()
    const { admin, careA, careB, book } = await setup(stamp)
    const bookingId = await book('Change')
    await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: careA.userId })
    await openChooser(page, admin.email, bookingId)

    await radio(page, `Dialog B ${stamp}`).check()
    await page.getByRole('button', { name: 'Continue' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: `Change the caregiver to Dialog B ${stamp}` })).toBeVisible()
    await expect(dialog.getByText(new RegExp(`Dialog A ${stamp} loses access to this booking and to the care notes for Change ${stamp} at once`))).toBeVisible()
    await expect(dialog.getByText(/The family is not notified automatically/)).toBeVisible()

    await dialog.getByRole('button', { name: 'Change caregiver' }).click()
    await page.waitForURL(`**/admin/bookings/${bookingId}?banner=changed`)
    await expect(page.getByRole('status').filter({ hasText: 'Caregiver changed.' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Caregiver' }).getByText(`Dialog B ${stamp}`)).toBeVisible()

    expect(await assignments(bookingId)).toEqual([
      { caregiver_id: careA.userId, previous_caregiver_id: null },
      { caregiver_id: careB.userId, previous_caregiver_id: careA.userId },
    ])
  })

  test('cancelling keeps the choice and sends nothing', async ({ page }) => {
    const stamp = Date.now()
    const { admin, book } = await setup(stamp)
    const bookingId = await book('Cancel')
    await openChooser(page, admin.email, bookingId)

    await radio(page, `Dialog A ${stamp}`).check()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(radio(page, `Dialog A ${stamp}`)).toBeChecked()
    expect(await assignments(bookingId)).toEqual([])

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(await assignments(bookingId)).toEqual([])
  })

  test('shows Assigning… with the buttons disabled, and a double tap assigns once', async ({ page }) => {
    const stamp = Date.now()
    const { admin, book } = await setup(stamp)
    const bookingId = await book('Slow')
    await openChooser(page, admin.email, bookingId)
    await radio(page, `Dialog A ${stamp}`).check()
    await page.getByRole('button', { name: 'Continue' }).click()

    let posts = 0
    await page.route(`**/admin/bookings/${bookingId}/choose-caregiver`, async (route) => {
      if (route.request().method() === 'POST') {
        posts += 1
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      await route.continue()
    })

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Assign caregiver' }).dblclick()
    const assigning = dialog.getByRole('button', { name: 'Assigning…' })
    await expect(assigning).toBeVisible()
    await expect(assigning).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    await page.waitForURL(`**/admin/bookings/${bookingId}?banner=assigned`)
    expect(posts).toBe(1)
    expect(await assignments(bookingId)).toHaveLength(1)
  })

  test('a lost connection keeps the dialog and the selection, and a retry works', async ({ page }) => {
    const stamp = Date.now()
    const { admin, careA, book } = await setup(stamp)
    const bookingId = await book('Offline')
    await openChooser(page, admin.email, bookingId)
    await radio(page, `Dialog A ${stamp}`).check()
    await page.getByRole('button', { name: 'Continue' }).click()

    const url = `**/admin/bookings/${bookingId}/choose-caregiver`
    await page.route(url, (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()))

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Assign caregiver' }).click()
    await expect(dialog.getByRole('alert')).toHaveText("Couldn't assign — check your connection and try again.")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/[A-Z]{2,}_[A-Z_]+/)).toHaveCount(0)

    // the selection is still there behind the dialog
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(radio(page, `Dialog A ${stamp}`)).toBeChecked()
    expect(await assignments(bookingId)).toEqual([])

    await page.unroute(url)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Assign caregiver' }).click()
    await page.waitForURL(`**/admin/bookings/${bookingId}?banner=assigned`)
    expect(await assignments(bookingId)).toEqual([{ caregiver_id: careA.userId, previous_caregiver_id: null }])
  })

  test('if someone else assigned the booking meanwhile, it says so, offers Close, and the screen refreshes', async ({ page }) => {
    const stamp = Date.now()
    const { admin, careA, book } = await setup(stamp)
    const bookingId = await book('Raced')
    await openChooser(page, admin.email, bookingId)
    await radio(page, `Dialog B ${stamp}`).check()
    await page.getByRole('button', { name: 'Continue' }).click()

    // another Admin assigns it to A while this dialog is open
    const other = await admin.client.rpc('assign_booking', { p_booking_id: bookingId, p_caregiver_id: careA.userId })
    expect(other.error).toBeNull()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Assign caregiver' }).click()
    await expect(dialog.getByRole('alert')).toContainText('This booking has changed since you opened it')
    await expect(dialog.getByRole('button', { name: 'Assign caregiver' })).toBeDisabled()
    await expect(dialog.getByText(/BOOKING_NOT_REQUESTED/)).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
    // refreshed: A is now the current caregiver and cannot be chosen; nothing was written for B
    await expect(page.locator('label').filter({ hasText: `Dialog A ${stamp}` }).getByText('Currently assigned')).toBeVisible()
    expect(await assignments(bookingId)).toEqual([{ caregiver_id: careA.userId, previous_caregiver_id: null }])
  })

  test('if the chosen caregiver stopped being Verified, it says so, refreshes the list and clears the selection', async ({ page }) => {
    const stamp = Date.now()
    const { admin, careB, book } = await setup(stamp)
    const bookingId = await book('Lost')
    await openChooser(page, admin.email, bookingId)
    await radio(page, `Dialog B ${stamp}`).check()
    await page.getByRole('button', { name: 'Continue' }).click()

    // B loses Verified while the dialog is open
    const removed = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: careB.userId, p_note: 'Reference failed' })
    expect(removed.error).toBeNull()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Assign caregiver' }).click()
    await expect(dialog.getByRole('alert')).toContainText('no longer Verified')
    // the dialog's own text does not change under the Admin
    await expect(dialog.getByRole('heading', { name: `Assign Dialog B ${stamp} to this booking` })).toBeVisible()
    await expect(dialog.getByText(/CAREGIVER_NOT_VERIFIED/)).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
    // B is gone from the list, the choice is cleared, and Continue waits for a new one
    await expect(page.getByText(`Dialog B ${stamp}`)).toHaveCount(0)
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(await assignments(bookingId)).toEqual([])
  })
})
