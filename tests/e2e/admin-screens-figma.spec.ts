import { test, expect, type Page } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI } from './helpers'

// The Admin screens as the frames of "FD-VERIFY screens" (sections D to F) draw them, measured at 1280px: the white
// bar 64 high with the brand and the tabs, the surface-grey page, the 28px title, the tables, the cards, the
// dialog. Colours are the Components variables.

test.use({ viewport: { width: 1280, height: 900 } })

const PRIMARY = 'rgb(11, 110, 105)'
const BORDER = 'rgb(123, 135, 148)'
const LINE = 'rgb(217, 222, 228)'
const SURFACE = 'rgb(245, 247, 250)'
const SOFT = 'rgb(227, 244, 242)'
const INK = 'rgb(31, 41, 51)'
const MUTED = 'rgb(82, 96, 109)'
const WHITE = 'rgb(255, 255, 255)'

const css = (locator: ReturnType<Page['locator']>, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property)
const px = async (locator: ReturnType<Page['locator']>, property: string) => parseFloat(await css(locator, property))

async function setup(stamp: number) {
  const admin = await createUserWithRole('admin', `Ada ${stamp}`)
  const family = await createUserWithRole('family_member', `Family ${stamp}`)
  const verified = await createUserWithRole('caregiver', `Frame Verified ${stamp}`)
  const plain = await createUserWithRole('caregiver', `Frame Plain ${stamp}`)
  await admin.client.rpc('verify_caregiver', { p_caregiver_id: verified.userId, p_note: 'Met in person' })
  const recipientId = await apiAddRecipient(family.client, family.userId, `Frame Recipient ${stamp}`)
  const { data } = await family.client
    .from('bookings')
    .insert({ account_id: family.userId, care_recipient_id: recipientId, bundle_code: 'medicheck', requested_datetime: '2030-01-15T06:30:00.000Z' })
    .select('id')
    .single()
  return { admin, verified, plain, bookingId: data!.id as string }
}

test.describe('Admin screens — the frames of sections D to F', () => {
  test('the shell: white bar 64 high, brand, tabs with a 4px primary line, surface-grey page', async ({ page }) => {
    const stamp = Date.now()
    const { admin } = await setup(stamp)
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto('/admin/caregivers')

    const nav = page.getByRole('navigation', { name: 'Main' })
    expect((await nav.boundingBox())!.height).toBe(64)
    expect(await css(nav, 'background-color')).toBe(WHITE)
    const brand = nav.getByText('Vizazi Care · Admin')
    expect(await px(brand, 'font-size')).toBe(18)
    expect(await css(brand, 'font-weight')).toBe('700')

    const current = nav.getByRole('link', { name: 'Caregivers' })
    expect(await css(current, 'font-weight')).toBe('700')
    expect(await px(current, 'border-bottom-width')).toBe(4)
    expect(await css(current, 'border-bottom-color')).toBe(PRIMARY)
    const other = nav.getByRole('link', { name: 'Booking Queue' })
    expect(await css(other, 'font-weight')).toBe('500')
    expect(await css(other, 'color')).toBe(MUTED)

    expect(await css(page.locator('main'), 'background-color')).toBe('rgba(0, 0, 0, 0)')
    expect(await css(page.locator('body > div').first(), 'background-color')).toBe(SURFACE)
    const title = page.getByRole('heading', { level: 1, name: 'Caregivers' })
    expect(await px(title, 'font-size')).toBe(28)
    expect(await css(title, 'font-weight')).toBe('700')
    expect(await px(page.locator('main'), 'padding-left')).toBe(32)
  })

  test('the Caregivers table: 12px radius, 44px header at 13px, 56px rows, primary underlined names, Pill/Verified 28 high', async ({ page }) => {
    const stamp = Date.now()
    const { admin } = await setup(stamp)
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto('/admin/caregivers')

    const box = page.locator('table').locator('xpath=..')
    expect(await px(box, 'border-top-left-radius')).toBe(12)
    expect(await css(box, 'border-top-color')).toBe(BORDER)
    const header = page.locator('thead tr')
    expect((await header.boundingBox())!.height).toBe(44)
    expect(await css(header, 'background-color')).toBe(SURFACE)
    expect(await px(page.getByRole('columnheader', { name: 'Name' }), 'font-size')).toBe(13)

    const row = page.getByRole('row').filter({ hasText: `Frame Verified ${stamp}` })
    expect((await row.boundingBox())!.height).toBe(56)
    expect(await css(row, 'border-top-color')).toBe(LINE)
    const name = row.getByRole('link')
    expect(await css(name, 'color')).toBe(PRIMARY)
    expect(await css(name, 'text-decoration-line')).toBe('underline')
    expect(await px(name, 'font-size')).toBe(15)
    expect(await css(name, 'font-weight')).toBe('600')

    const pill = row.getByText('Verified', { exact: true })
    expect(Math.round((await pill.boundingBox())!.height)).toBe(28)
    expect(await css(pill, 'background-color')).toBe(SOFT)
    expect(await css(pill, 'font-weight')).toBe('600')
    const dash = page.getByRole('row').filter({ hasText: `Frame Plain ${stamp}` }).getByText('Not verified', { exact: true })
    expect(Math.round((await dash.boundingBox())!.height)).toBe(32)
    expect(await css(dash, 'border-top-color')).toBe(BORDER)
  })

  test('Caregiver Detail: current status card, the 260px button, the history entry in three columns', async ({ page }) => {
    const stamp = Date.now()
    const { admin, verified } = await setup(stamp)
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/caregivers/${verified.userId}`)

    const card = page.getByRole('region', { name: 'Current status' })
    expect(await px(card, 'border-top-left-radius')).toBe(12)
    expect(await px(card, 'padding-top')).toBe(20)
    expect(await px(page.getByRole('heading', { name: 'Current status' }), 'font-size')).toBe(14)
    const remove = page.getByRole('button', { name: 'Remove Verified status' })
    expect((await remove.boundingBox())!.width).toBe(260)
    expect((await remove.boundingBox())!.height).toBe(48)
    expect(await css(remove, 'border-top-color')).toBe('rgb(180, 35, 24)')

    const entry = page.getByRole('region', { name: 'Verification history' }).getByRole('listitem')
    await expect(entry).toContainText('Marked Verified')
    expect(await px(entry.locator('span').first(), 'font-size')).toBe(15)
    expect((await entry.locator('span').first().boundingBox())!.width).toBe(200)
  })

  test('Booking Queue: tabs 44 high with a 3px line, table columns, 44px Assign caregiver button', async ({ page }) => {
    const stamp = Date.now()
    const { admin } = await setup(stamp)
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    const tab = page.getByRole('link', { name: 'Requested', exact: true })
    expect((await tab.boundingBox())!.height).toBe(44)
    expect(await px(tab, 'border-bottom-width')).toBe(3)
    expect(await css(tab, 'font-weight')).toBe('700')
    for (const heading of ['Care recipient', 'Bundle', 'Date and time of the visit', 'Requested at', 'Action']) {
      await expect(page.getByRole('columnheader', { name: heading })).toBeVisible()
    }
    const row = page.getByRole('row').filter({ hasText: `Frame Recipient ${stamp}` })
    expect((await row.boundingBox())!.height).toBe(64)
    const assign = row.getByRole('link', { name: 'Assign caregiver' })
    expect((await assign.boundingBox())!.height).toBe(44)
    expect(await px(assign, 'border-top-width')).toBe(2)
    expect(await css(assign, 'border-top-color')).toBe(PRIMARY)
  })

  test('Booking Detail: Requested chip, the card of rows with 220px labels, the 260px Assign caregiver button', async ({ page }) => {
    const stamp = Date.now()
    const { admin, bookingId } = await setup(stamp)
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/bookings/${bookingId}`)

    const chip = page.getByText('Requested', { exact: true })
    expect(await css(chip, 'background-color')).toBe('rgb(255, 243, 220)')
    expect(await css(chip, 'color')).toBe('rgb(122, 65, 0)')
    const card = page.getByRole('region', { name: 'Booking', exact: true })
    expect(await px(card, 'border-top-left-radius')).toBe(12)
    expect(await px(card, 'padding-left')).toBe(20)
    const label = card.getByText('Care recipient', { exact: true })
    expect((await label.boundingBox())!.width).toBe(220)
    expect(await px(label, 'font-size')).toBe(14)
    const value = card.getByText(`Frame Recipient ${stamp}`, { exact: true })
    expect(await px(value, 'font-size')).toBe(16)
    expect(await css(value, 'font-weight')).toBe('500')
    const assign = page.getByRole('link', { name: 'Assign caregiver' })
    expect((await assign.boundingBox())!.width).toBe(260)
    expect(await css(assign, 'background-color')).toBe(PRIMARY)
  })

  test('Choose a caregiver: selected card soft with a 3px line, Cancel 140 and Assign {name} primary, the dialog 560 wide', async ({ page }) => {
    const stamp = Date.now()
    const { admin, verified, bookingId } = await setup(stamp)
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/bookings/${bookingId}/choose-caregiver`)

    await expect(page.getByRole('heading', { level: 1, name: 'Choose a caregiver' })).toBeVisible()
    const card = page.locator('label').filter({ hasText: `Frame Verified ${stamp}` })
    expect(await px(card, 'border-top-left-radius')).toBe(12)
    expect(await px(card, 'border-top-width')).toBe(1)
    expect(await css(card, 'background-color')).toBe(WHITE)
    await card.getByRole('radio').check()
    expect(await px(card, 'border-top-width')).toBe(3)
    expect(await css(card, 'border-top-color')).toBe(PRIMARY)
    expect(await css(card, 'background-color')).toBe(SOFT)
    expect(await css(card.getByText(`Frame Verified ${stamp}`, { exact: true }), 'font-weight')).toBe('700')

    const cancel = page.getByRole('button', { name: 'Cancel' })
    expect((await cancel.boundingBox())!.width).toBe(140)
    const assign = page.getByRole('button', { name: `Assign Frame Verified ${stamp}` })
    expect((await assign.boundingBox())!.width).toBeGreaterThanOrEqual(280)
    expect(await css(assign, 'background-color')).toBe(PRIMARY)
    await expect(page.getByText(/not shown because they are Not verified\./)).toBeVisible()

    await assign.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Assign caregiver' })).toBeVisible()
    const dialogBox = (await dialog.boundingBox())!
    expect(dialogBox.width).toBe(560)
    expect(await px(dialog, 'border-top-left-radius')).toBe(16)
    expect(await px(dialog.locator('> div'), 'padding-left')).toBe(24)
    expect(await px(dialog.getByRole('heading', { name: 'Assign caregiver' }), 'font-size')).toBe(22)
    await expect(dialog.getByText(`Frame Recipient ${stamp} · MediCheck · Tue 15 Jan 2030, 09:30 EAT`)).toBeVisible()
    await expect(dialog.getByText(new RegExp(`Frame Verified ${stamp} will see this booking and Frame Recipient ${stamp}.s care notes`))).toBeVisible()
    expect((await dialog.getByRole('button', { name: 'Cancel' }).boundingBox())!.width).toBe(140)
    expect((await dialog.getByRole('button', { name: 'Assign', exact: true }).boundingBox())!.width).toBe(160)
    expect(verified.userId).toBeTruthy()
  })

  test('Mark as Verified dialog: the frame text, the warning note, the hint, Cancel 140 and the 220px button', async ({ page }) => {
    const stamp = Date.now()
    const { admin, plain } = await setup(stamp)
    await logInViaUI(page, admin.email, undefined, '**/admin/queue')
    await page.goto(`/admin/caregivers/${plain.userId}`)
    await expect(page.getByText('Not verified. No one has marked this caregiver Verified yet.')).toBeVisible()
    await page.getByRole('button', { name: 'Mark as Verified' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Mark as Verified' })).toBeVisible()
    await expect(dialog.getByText(`Record the result of the ID check and review you did outside the app. Frame Plain ${stamp} will be offered for new bookings once you save.`)).toBeVisible()
    await expect(dialog.getByRole('checkbox', { name: "I have checked this caregiver's identity" })).toBeVisible()
    await expect(dialog.getByRole('checkbox', { name: 'I have reviewed this caregiver' })).toBeVisible()
    await expect(dialog.getByLabel('What did you check? (required)')).toHaveAttribute('placeholder', 'For example: what you checked, and that a background check was done and its outcome')
    const warning = dialog.getByText('Do not type ID numbers or copy the contents of any document or record. Write only what you checked and the outcome.')
    expect(await css(warning.locator('xpath=..'), 'background-color')).toBe(SURFACE)
    await expect(dialog.getByText('To continue: tick both boxes and write what you checked.')).toBeVisible()
    expect((await dialog.getByRole('button', { name: 'Cancel' }).boundingBox())!.width).toBe(140)
    const submit = dialog.getByRole('button', { name: 'Mark as Verified' })
    expect((await submit.boundingBox())!.width).toBe(220)
    await expect(submit).toBeDisabled()
    expect(await css(dialog, 'color')).toBe(INK)
  })
})
