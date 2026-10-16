import { test, expect, type Page } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI } from './helpers'

// DEV-039: the Remove Verified dialog on the Caregiver Detail screen (frame
// VER-04): the consequences in three short paragraphs, a required reason, a
// destructive button set apart by wording, style and place, and on success the
// affected-bookings panel updates.

async function openRemoveDialog(page: Page, caregiverName: string, options: { withBooking?: boolean } = {}) {
  const stamp = Date.now()
  const adminName = `Ada ${stamp}`
  const admin = await createUserWithRole('admin', adminName)
  const caregiver = await createUserWithRole('caregiver', caregiverName)
  const { error } = await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
  expect(error).toBeNull()

  if (options.withBooking) {
    const family = await createUserWithRole('family_member', 'Family Member')
    const recipientId = await apiAddRecipient(family.client, family.userId, `Mzee ${stamp}`)
    const { data: booking } = await family.client
      .from('bookings')
      .insert({
        account_id: family.userId,
        care_recipient_id: recipientId,
        bundle_code: 'medicheck',
        requested_datetime: '2030-01-15T06:30:00.000Z',
      })
      .select('id')
      .single()
    await admin.client.rpc('assign_booking', { p_booking_id: booking!.id, p_caregiver_id: caregiver.userId })
  }

  await logInViaUI(page, admin.email, undefined, '**/admin/queue')
  await page.goto(`/admin/caregivers/${caregiver.userId}`)
  await page.getByRole('button', { name: 'Remove Verified', exact: true }).click()
  return { admin, adminName, caregiver, stamp, dialog: page.getByRole('dialog') }
}

test.describe('DEV-039 — Remove Verified dialog', () => {
  test('explains what happens and needs a reason before the button works', async ({ page }) => {
    const { dialog } = await openRemoveDialog(page, 'Consequence Caregiver')

    await expect(dialog.getByRole('heading', { name: 'Remove Verified status from Consequence Caregiver' })).toBeVisible()

    // three short paragraphs: the caregiver, what the Admin does next, what families see
    await expect(dialog.getByText(/loses access to their assigned bookings and to the care notes at once, even during a visit/)).toBeVisible()
    await expect(dialog.getByText('The app does not tell them.', { exact: false })).toBeVisible()
    await expect(dialog.getByText(/have not started will be listed under "Bookings that need a new caregiver"/)).toBeVisible()
    await expect(dialog.getByText(/Vizazi Care is confirming their caregiver, without the name/)).toBeVisible()
    await expect(dialog.getByText(/started or finished will still see the caregiver's name/)).toBeVisible()

    // a reason is required; nothing asks for an ID
    const submit = dialog.getByRole('button', { name: 'Remove Verified status' })
    await expect(dialog.getByRole('textbox')).toHaveCount(1)
    await expect(dialog.locator('input[type="file"], input[type="number"]')).toHaveCount(0)
    await expect(dialog.getByText(/Do not type ID numbers/)).toBeVisible()
    await expect(submit).toBeDisabled()
    await expect(dialog.getByText('Still needed: write the reason.')).toBeVisible()
    await dialog.getByLabel('Why are you removing Verified status?').fill('   ')
    await expect(submit).toBeDisabled()
    await dialog.getByLabel('Why are you removing Verified status?').fill('Reference check failed')
    await expect(dialog.getByText(/Still needed/)).toHaveCount(0)
    await expect(submit).toBeEnabled()
  })

  test('the destructive button is set apart by wording, style and place', async ({ page }) => {
    const { dialog } = await openRemoveDialog(page, 'Placement Caregiver')
    await dialog.getByLabel('Why are you removing Verified status?').fill('Reference check failed')

    const cancel = dialog.getByRole('button', { name: 'Cancel' })
    const remove = dialog.getByRole('button', { name: 'Remove Verified status' })

    // wording: it names exactly what it does; the safe choice is first for the keyboard
    expect(await dialog.getByRole('button').allInnerTexts()).toEqual(['Cancel', 'Remove Verified status'])

    // style: outlined in the danger colour, white inside; Cancel carries the primary outline
    await expect(remove).toHaveCSS('border-top-color', 'rgb(180, 35, 24)')
    await expect(remove).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(cancel).toHaveCSS('border-top-color', 'rgb(11, 110, 105)')

    // place: Cancel takes the usual confirm position on the right, the destructive button sits to its left
    const [cancelBox, removeBox] = [await cancel.boundingBox(), await remove.boundingBox()]
    expect(cancelBox!.x).toBeGreaterThan(removeBox!.x)
  })

  test('removing marks the caregiver not Verified and the affected-bookings panel updates', async ({ page }) => {
    const { adminName, dialog } = await openRemoveDialog(page, 'Removed Caregiver', { withBooking: true })
    const panel = page.getByRole('region', { name: 'Bookings that need a new caregiver' })

    await dialog.getByLabel('Why are you removing Verified status?').fill('Reference check failed')
    await dialog.getByRole('button', { name: 'Remove Verified status' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status')).toHaveText('Removed Caregiver is no longer Verified.')
    await expect(page.getByText('Not verified', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark as Verified' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Verified', exact: true })).toHaveCount(0)

    // the booking now needs a new caregiver
    await expect(panel.getByText('Tue 15 Jan 2030, 09:30 EAT')).toBeVisible()
    await expect(panel.getByText('No upcoming bookings are affected.')).toHaveCount(0)

    // and the reason is in the history, newest first, with the Admin's name
    const history = page.getByRole('region', { name: 'Verification history' }).getByRole('listitem')
    await expect(history).toHaveCount(2)
    await expect(history.first()).toContainText('Removed Verified status')
    await expect(history.first()).toContainText('Reference check failed')
    await expect(history.first()).toContainText(`By ${adminName}`)
  })

  test('cancelling closes it and reopening starts empty', async ({ page }) => {
    const { dialog } = await openRemoveDialog(page, 'Cancel Caregiver')
    await dialog.getByLabel('Why are you removing Verified status?').fill('half written')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: 'Remove Verified', exact: true }).click()
    await expect(dialog.getByLabel('Why are you removing Verified status?')).toHaveValue('')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Verified', { exact: true })).toBeVisible()
  })

  test('shows Saving… while the request runs and a double tap sends it once', async ({ page }) => {
    const { dialog, caregiver } = await openRemoveDialog(page, 'Slow Caregiver')
    await dialog.getByLabel('Why are you removing Verified status?').fill('Reference check failed')

    let posts = 0
    await page.route(`**/admin/caregivers/${caregiver.userId}`, async (route) => {
      if (route.request().method() === 'POST') {
        posts += 1
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      await route.continue()
    })

    await dialog.getByRole('button', { name: 'Remove Verified status' }).dblclick()
    const saving = dialog.getByRole('button', { name: 'Saving…' })
    await expect(saving).toBeVisible()
    await expect(saving).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    await expect(dialog).toBeHidden()
    expect(posts).toBe(1)
    await expect(page.getByRole('region', { name: 'Verification history' }).getByRole('listitem')).toHaveCount(2)
  })

  test('a lost connection keeps the dialog open with the reason, and a retry works', async ({ page }) => {
    const { dialog, caregiver } = await openRemoveDialog(page, 'Offline Caregiver')
    await dialog.getByLabel('Why are you removing Verified status?').fill('Kept through the failure')

    const url = `**/admin/caregivers/${caregiver.userId}`
    await page.route(url, (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()))

    await dialog.getByRole('button', { name: 'Remove Verified status' }).click()
    await expect(dialog.getByRole('alert')).toHaveText("Couldn't save — check your connection and try again.")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Why are you removing Verified status?')).toHaveValue('Kept through the failure')
    await expect(dialog.getByText(/[A-Z]{2,}_[A-Z_]+/)).toHaveCount(0)

    await page.unroute(url)
    const retry = dialog.getByRole('button', { name: 'Remove Verified status' })
    await expect(retry).toBeEnabled()
    await retry.click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status')).toHaveText('Offline Caregiver is no longer Verified.')
  })

  test('if the status changed meanwhile, it says so, keeps the reason and offers only Close', async ({ page }) => {
    const { admin, caregiver, dialog } = await openRemoveDialog(page, 'Raced Caregiver')
    await dialog.getByLabel('Why are you removing Verified status?').fill('My reason')

    // another Admin removes Verified from the same caregiver while this dialog is open
    const { error } = await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: caregiver.userId, p_note: 'Done elsewhere' })
    expect(error).toBeNull()

    await dialog.getByRole('button', { name: 'Remove Verified status' }).click()
    await expect(dialog.getByRole('alert')).toContainText('status changed while you were working')
    await expect(dialog.getByLabel('Why are you removing Verified status?')).toHaveValue('My reason')
    await expect(dialog.getByRole('button', { name: 'Remove Verified status' })).toBeDisabled()
    await expect(dialog.getByText(/NOT_VERIFIED/)).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Not verified', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark as Verified' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Verification history' }).getByRole('listitem')).toHaveCount(2)
  })
})
