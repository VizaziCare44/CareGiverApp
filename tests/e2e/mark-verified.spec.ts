import { test, expect, type Page } from '@playwright/test'
import { createUserWithRole, logInViaUI } from './helpers'

// DEV-038: the Mark as Verified dialog on the Caregiver Detail screen (frames
// VER-03, 03b, 03c): two required confirmations, the required note, no field
// for an ID number or image, a button that stays disabled until all three are
// done and says what is missing, a "Saving…" state, and the failure cases.

async function openDetail(page: Page, caregiverName: string) {
  const stamp = Date.now()
  const admin = await createUserWithRole('admin', `Ada ${stamp}`)
  const caregiver = await createUserWithRole('caregiver', caregiverName)
  await logInViaUI(page, admin.email, undefined, '**/admin/queue')
  await page.goto(`/admin/caregivers/${caregiver.userId}`)
  await page.getByRole('button', { name: 'Mark as Verified' }).click()
  return { admin, adminName: `Ada ${stamp}`, caregiver, dialog: page.getByRole('dialog') }
}

test.describe('DEV-038 — Mark as Verified dialog', () => {
  test('the button stays disabled until both confirmations and the note are done, and says what is missing', async ({ page }) => {
    const { dialog } = await openDetail(page, 'Dialog Caregiver')

    await expect(dialog.getByRole('heading', { name: 'Mark Dialog Caregiver as Verified' })).toBeVisible()
    const submit = dialog.getByRole('button', { name: 'Mark as Verified' })
    const first = dialog.getByRole('checkbox', { name: /I have met Dialog Caregiver in person/ })
    const second = dialog.getByRole('checkbox', { name: 'I have checked their references.' })
    const note = dialog.getByLabel('What did you check?')

    // the note is required and has a helper warning against ID numbers; nothing asks for an ID
    await expect(dialog.getByText(/Do not type ID numbers/)).toBeVisible()
    await expect(dialog.locator('input[type="file"], input[type="number"]')).toHaveCount(0)
    await expect(dialog.getByRole('textbox')).toHaveCount(1)

    await expect(submit).toBeDisabled()
    await expect(dialog.getByText('Still needed: tick the first box, tick the second box, write what you checked.')).toBeVisible()

    await first.check()
    await expect(dialog.getByText('Still needed: tick the second box, write what you checked.')).toBeVisible()
    await second.check()
    await expect(dialog.getByText('Still needed: write what you checked.')).toBeVisible()
    await expect(submit).toBeDisabled()

    await note.fill('   ')
    await expect(submit).toBeDisabled()
    await note.fill('Met in person, two references called')
    await expect(dialog.getByText(/Still needed/)).toHaveCount(0)
    await expect(submit).toBeEnabled()

    // both confirmations are required, not just the note
    await second.uncheck()
    await expect(submit).toBeDisabled()
  })

  test('saving marks the caregiver Verified and the page shows it', async ({ page }) => {
    const { adminName, dialog } = await openDetail(page, 'Saved Caregiver')

    await dialog.getByRole('checkbox', { name: /I have met Saved Caregiver in person/ }).check()
    await dialog.getByRole('checkbox', { name: 'I have checked their references.' }).check()
    await dialog.getByLabel('What did you check?').fill('Met in person, two references called')
    await dialog.getByRole('button', { name: 'Mark as Verified' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status')).toHaveText('Saved Caregiver is now Verified.')
    await expect(page.getByText('Verified', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Verified' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark as Verified' })).toHaveCount(0)

    const history = page.getByRole('region', { name: 'Verification history' }).getByRole('listitem')
    await expect(history).toHaveCount(1)
    await expect(history.first()).toContainText('Marked as Verified')
    await expect(history.first()).toContainText('Met in person, two references called')
    await expect(history.first()).toContainText(`By ${adminName}`)
  })

  test('cancelling and Escape close it, and reopening starts empty', async ({ page }) => {
    const { dialog } = await openDetail(page, 'Cancel Caregiver')
    await dialog.getByRole('checkbox', { name: /I have met/ }).check()
    await dialog.getByLabel('What did you check?').fill('half done')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: 'Mark as Verified' }).click()
    await expect(dialog.getByRole('checkbox', { name: /I have met/ })).not.toBeChecked()
    await expect(dialog.getByLabel('What did you check?')).toHaveValue('')

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Not verified', { exact: true })).toBeVisible()
  })

  test('shows Saving… while the request runs and a double tap sends it once', async ({ page }) => {
    const { dialog, caregiver } = await openDetail(page, 'Slow Caregiver')
    await dialog.getByRole('checkbox', { name: /I have met/ }).check()
    await dialog.getByRole('checkbox', { name: 'I have checked their references.' }).check()
    await dialog.getByLabel('What did you check?').fill('Met in person')

    let posts = 0
    await page.route(`**/admin/caregivers/${caregiver.userId}`, async (route) => {
      if (route.request().method() === 'POST') {
        posts += 1
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      await route.continue()
    })

    const submit = dialog.getByRole('button', { name: 'Mark as Verified' })
    await submit.dblclick()
    const saving = dialog.getByRole('button', { name: 'Saving…' })
    await expect(saving).toBeVisible()
    await expect(saving).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    await expect(dialog).toBeHidden()
    expect(posts).toBe(1)
    await expect(page.getByRole('region', { name: 'Verification history' }).getByRole('listitem')).toHaveCount(1)
  })

  test('a lost connection keeps the dialog open with the note, and a retry works', async ({ page }) => {
    const { dialog, caregiver } = await openDetail(page, 'Offline Caregiver')
    await dialog.getByRole('checkbox', { name: /I have met/ }).check()
    await dialog.getByRole('checkbox', { name: 'I have checked their references.' }).check()
    await dialog.getByLabel('What did you check?').fill('Met in person, kept through the failure')

    const url = `**/admin/caregivers/${caregiver.userId}`
    await page.route(url, (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()))

    await dialog.getByRole('button', { name: 'Mark as Verified' }).click()
    await expect(dialog.getByRole('alert')).toHaveText("Couldn't save — check your connection and try again.")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('What did you check?')).toHaveValue('Met in person, kept through the failure')
    await expect(dialog.getByRole('checkbox', { name: /I have met/ })).toBeChecked()
    // nothing shown to the user looks like a code
    await expect(dialog.getByText(/[A-Z]{2,}_[A-Z_]+/)).toHaveCount(0)

    await page.unroute(url)
    const retry = dialog.getByRole('button', { name: 'Mark as Verified' })
    await expect(retry).toBeEnabled()
    await retry.click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status')).toHaveText('Offline Caregiver is now Verified.')
  })

  test('if the status changed meanwhile, it says so, keeps the note and offers only Close', async ({ page }) => {
    const { admin, caregiver, dialog } = await openDetail(page, 'Raced Caregiver')
    await dialog.getByRole('checkbox', { name: /I have met/ }).check()
    await dialog.getByRole('checkbox', { name: 'I have checked their references.' }).check()
    await dialog.getByLabel('What did you check?').fill('My note')

    // another Admin verifies the same caregiver while this dialog is open
    const { error } = await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Done elsewhere' })
    expect(error).toBeNull()

    await dialog.getByRole('button', { name: 'Mark as Verified' }).click()
    await expect(dialog.getByRole('alert')).toContainText("status changed while you were working")
    await expect(dialog.getByLabel('What did you check?')).toHaveValue('My note')
    await expect(dialog.getByRole('button', { name: 'Mark as Verified' })).toBeDisabled()
    await expect(dialog.getByText(/ALREADY_VERIFIED/)).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
    // the page behind has refreshed to the real status and history
    await expect(page.getByText('Verified', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Verified' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Verification history' }).getByRole('listitem')).toHaveCount(1)
  })
})
