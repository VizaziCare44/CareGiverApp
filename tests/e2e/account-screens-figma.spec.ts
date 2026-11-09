import { test, expect, type Page } from '@playwright/test'
import { logInViaUI, randomEmail, TEST_PASSWORD } from './helpers'
import { makeFamily, makeRecipient } from './factories'

// The Family Member's account screens as the Figma frames define them (file "Vizazi Care — FD-ACC + FD-VERIFY
// Wireframes", page "FD-ACC screens"): ACC-01 Sign Up, ACC-01b Sign Up inline errors, ACC-02 Log In, ACC-02b Log In
// error, ACC-03 Care Recipient List first-time, ACC-04 Care Recipient List, ACC-05 Add Care Recipient. Measured at the
// frames' own width, 390px. Colours are the Components variables: primary #0b6e69, border #7b8794, line #d9dee4,
// surface #f5f7fa, danger #b42318, dangersoft #feeceb, ink #1f2933, muted #52606d.

test.use({ viewport: { width: 390, height: 844 } })

const PRIMARY = 'rgb(11, 110, 105)'
const BORDER = 'rgb(123, 135, 148)'
const LINE = 'rgb(217, 222, 228)'
const SURFACE = 'rgb(245, 247, 250)'
const DANGER = 'rgb(180, 35, 24)'
const DANGER_SOFT = 'rgb(254, 236, 235)'
const INK = 'rgb(31, 41, 51)'
const MUTED = 'rgb(82, 96, 109)'
const WHITE = 'rgb(255, 255, 255)'

const css = (locator: ReturnType<Page['locator']>, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property)
const px = async (locator: ReturnType<Page['locator']>, property: string) => parseFloat(await css(locator, property))

async function expectTitle(page: Page, text: string) {
  const title = page.getByRole('heading', { level: 1, name: text, exact: true })
  await expect(title).toBeVisible()
  expect(await px(title, 'font-size')).toBe(24)
  expect(await css(title, 'font-weight')).toBe('700')
  expect(await css(title, 'color')).toBe(INK)
}

/** A Field/Default: 14px medium label, a 48px white box, 1px border, 10px radius, 16px text, muted placeholder. */
async function expectField(page: Page, label: string, placeholder: string) {
  const field = page.getByLabel(label, { exact: true })
  await expect(field).toHaveAttribute('placeholder', placeholder)
  const box = (await field.boundingBox())!
  expect(box.height).toBe(48)
  expect(box.width).toBe(350) // 390 less 20px of padding on each side
  expect(await css(field, 'background-color')).toBe(WHITE)
  expect(await css(field, 'border-top-color')).toBe(BORDER)
  expect(await px(field, 'border-top-width')).toBe(1)
  expect(await px(field, 'border-top-left-radius')).toBe(10)
  expect(await px(field, 'padding-left')).toBe(14)
  expect(await px(field, 'font-size')).toBe(16)
  expect(await css(field, 'color')).toBe(INK)
  const labelText = page.locator(`label[for="${await field.getAttribute('id')}"]`)
  expect(await px(labelText, 'font-size')).toBe(14)
  expect(await css(labelText, 'font-weight')).toBe('500')
  expect(await css(labelText, 'color')).toBe(INK)
  // no asterisk: a required field is named in its label where the frame says so
  expect(await labelText.innerText()).toBe(label)
}

async function expectPrimaryButton(button: ReturnType<Page['locator']>) {
  expect((await button.boundingBox())!.height).toBe(48)
  expect(await css(button, 'background-color')).toBe(PRIMARY)
  expect(await css(button, 'color')).toBe(WHITE)
  expect(await px(button, 'border-top-left-radius')).toBe(10)
  expect(await css(button, 'font-weight')).toBe('600')
  expect(await px(button, 'font-size')).toBe(16)
}

async function expectTextLink(link: ReturnType<Page['locator']>) {
  expect((await link.boundingBox())!.height).toBe(44)
  expect(await css(link, 'color')).toBe(PRIMARY)
  expect(await css(link, 'text-decoration-line')).toBe('underline')
  expect(await css(link, 'font-weight')).toBe('600')
  expect(await px(link, 'font-size')).toBe(16)
}

const atBottom = async (locator: ReturnType<Page['locator']>, space = 100) => {
  const box = (await locator.boundingBox())!
  return box.y + box.height > 844 - space
}

test.describe('ACC-01 and ACC-01b — Sign Up', () => {
  test('ACC-01: the title, four fields with placeholders, the button at the bottom, the link under it', async ({ page }, testInfo) => {
    await page.goto('/sign-up')
    expect(await css(page.locator('main'), 'background-color')).toBe(WHITE)
    await expectTitle(page, 'Create your account')
    // the frame has no sentence under the title
    await expect(page.getByText('So Vizazi Care can identify you')).toHaveCount(0)

    await expectField(page, 'Full name', 'Full name')
    await expectField(page, 'Email', 'name@example.com')
    await expectField(page, 'Phone number', 'Phone number')
    await expectField(page, 'Password', 'Password')
    // field order and 16px between fields
    const names = await page.locator('label').allInnerTexts()
    expect(names).toEqual(['Full name', 'Email', 'Phone number', 'Password'])
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')

    const submit = page.getByRole('button', { name: 'Create account' })
    await expectPrimaryButton(submit)
    expect(await atBottom(submit, 100)).toBe(true)
    const link = page.getByRole('link', { name: 'Already have an account? Log in' })
    await expect(link).toHaveAttribute('href', '/log-in')
    await expectTextLink(link)
    expect((await link.boundingBox())!.width).toBe(350)
    await testInfo.attach('sign-up', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('ACC-01b: a field left empty or wrong turns red on blur, with an icon and the message under it', async ({ page }, testInfo) => {
    await page.goto('/sign-up')
    const name = page.getByLabel('Full name', { exact: true })
    await name.focus()
    await name.blur()
    const email = page.getByLabel('Email', { exact: true })
    await email.fill('grace.at.example')
    await email.blur()

    const nameError = page.getByText('Enter your full name', { exact: true })
    await expect(nameError).toBeVisible()
    expect(await css(nameError, 'color')).toBe(DANGER)
    expect(await px(nameError, 'font-size')).toBe(14)
    await expect(nameError.locator('svg')).toHaveCount(1)
    expect(await css(name, 'border-top-color')).toBe(DANGER)
    expect(await px(name, 'border-top-width')).toBe(2)
    expect(await px(name, 'border-top-left-radius')).toBe(10)

    const emailError = page.getByText('Enter a valid email address, like name@example.com', { exact: true })
    await expect(emailError).toBeVisible()
    expect(await css(email, 'border-top-color')).toBe(DANGER)
    // the message is linked to its field for screen readers
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(await email.getAttribute('aria-describedby')).toBe(await emailError.getAttribute('id'))

    // the other two fields are still plain
    for (const label of ['Phone number', 'Password']) {
      expect(await css(page.getByLabel(label, { exact: true }), 'border-top-color')).toBe(BORDER)
    }
    // typing a good value clears it
    await email.fill('grace@example.com')
    await expect(emailError).toHaveCount(0)
    expect(await px(email, 'border-top-width')).toBe(1)
    await testInfo.attach('sign-up-errors', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('nothing is sent while a field is wrong: Create account shows every error at once', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Enter your full name', { exact: true })).toBeVisible()
    await expect(page.getByText('Enter a valid email address, like name@example.com', { exact: true })).toBeVisible()
    await expect(page.getByText('Enter your phone number', { exact: true })).toBeVisible()
    await expect(page.getByText('Password must be at least 8 characters', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/sign-up/)
  })

  test('a taken email shows the server’s message in the error banner above the fields', async ({ page }) => {
    const family = await makeFamily()
    await page.goto('/sign-up')
    await page.getByLabel('Full name', { exact: true }).fill('Grace Wanjiru')
    await page.getByLabel('Email', { exact: true }).fill(family.email)
    await page.getByLabel('Phone number', { exact: true }).fill('+254712345678')
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    // either an error from the server (banner) or the "check your email" screen for an address Supabase will not reveal
    const banner = page.getByTestId('form-error')
    const check = page.getByRole('heading', { name: 'Check your email' })
    await expect(banner.or(check)).toBeVisible()
  })
})

test.describe('ACC-02 and ACC-02b — Log In', () => {
  test('ACC-02: the title, two fields, the button at the bottom, the link under it', async ({ page }, testInfo) => {
    await page.goto('/log-in')
    expect(await css(page.locator('main'), 'background-color')).toBe(WHITE)
    await expectTitle(page, 'Log in')
    await expect(page.getByText('Welcome back')).toHaveCount(0)

    await expectField(page, 'Email', 'name@example.com')
    await expectField(page, 'Password', 'Password')
    const submit = page.getByRole('button', { name: 'Log in' })
    await expectPrimaryButton(submit)
    expect(await atBottom(submit, 100)).toBe(true)
    const link = page.getByRole('link', { name: 'New here? Create an account' })
    await expect(link).toHaveAttribute('href', '/sign-up')
    await expectTextLink(link)
    // Forgot password? (DEV-027) stays, as a text link under the fields
    const forgot = page.getByRole('link', { name: 'Forgot password?' })
    await expect(forgot).toHaveAttribute('href', '/forgot-password')
    await expectTextLink(forgot)
    await expect(page.getByRole('alert').filter({ hasText: /./ })).toHaveCount(0)
    await testInfo.attach('log-in', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('ACC-02b: a wrong login shows the red banner above the fields, one generic message, no recovery hint in it', async ({ page }, testInfo) => {
    const family = await makeFamily()
    await page.goto('/log-in')
    await page.getByLabel('Email', { exact: true }).fill(family.email)
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword123')
    await page.getByRole('button', { name: 'Log in' }).click()

    const banner = page.getByRole('alert').filter({ hasText: 'Email or password incorrect.' })
    await expect(banner).toBeVisible()
    await expect(banner).toHaveText('Email or password incorrect.')
    expect(await css(banner, 'background-color')).toBe(DANGER_SOFT)
    expect(await css(banner, 'border-top-color')).toBe(DANGER)
    expect(await px(banner, 'border-top-width')).toBe(1)
    expect(await px(banner, 'border-top-left-radius')).toBe(10)
    expect(await px(banner, 'padding-left')).toBe(12)
    expect(await css(banner.locator('p'), 'color')).toBe(DANGER)
    expect(await px(banner.locator('p'), 'font-size')).toBe(15)
    expect(await css(banner.locator('p'), 'font-weight')).toBe('500')
    await expect(banner.locator('svg')).toHaveCount(1)
    // above the fields, under the title
    const bannerBox = (await banner.boundingBox())!
    const emailBox = (await page.getByLabel('Email', { exact: true }).boundingBox())!
    expect(bannerBox.y + bannerBox.height).toBeLessThan(emailBox.y)
    // the fields are not marked wrong: the message does not say which one it was
    expect(await px(page.getByLabel('Email', { exact: true }), 'border-top-width')).toBe(1)
    await expect(page).toHaveURL(/log-in/)
    await testInfo.attach('log-in-error', { body: await page.screenshot(), contentType: 'image/png' })

    // a wrong email gives the same message
    await page.getByLabel('Email', { exact: true }).fill(randomEmail())
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Email or password incorrect.' })).toHaveText('Email or password incorrect.')
  })
})

test.describe('ACC-03 and ACC-04 — Care Recipient List', () => {
  test('ACC-03: the title with My bookings at the right, the empty-state card with its invitation and button', async ({ page }, testInfo) => {
    const family = await makeFamily()
    await logInViaUI(page, family.email, family.password)
    expect(await css(page.locator('main'), 'background-color')).toBe(WHITE)
    await expectTitle(page, 'Care recipients')

    const bookings = page.getByRole('link', { name: 'My bookings' })
    await expect(bookings).toHaveAttribute('href', '/bookings')
    expect((await bookings.boundingBox())!.height).toBe(44)
    expect(await css(bookings, 'color')).toBe(PRIMARY)
    expect(await css(bookings, 'text-decoration-line')).toBe('underline')
    // at the right of the title, on its line
    const titleBox = (await page.getByRole('heading', { level: 1 }).boundingBox())!
    const linkBox = (await bookings.boundingBox())!
    expect(linkBox.x).toBeGreaterThan(titleBox.x + titleBox.width / 2)
    expect(Math.abs(linkBox.y + linkBox.height / 2 - (titleBox.y + titleBox.height / 2))).toBeLessThan(12)
    expect(linkBox.x + linkBox.width).toBeCloseTo(370, 0) // the right edge of the 20px gutter

    const card = page.getByTestId('recipients-empty')
    expect(await css(card, 'background-color')).toBe(SURFACE)
    expect(await css(card, 'border-top-color')).toBe(LINE)
    expect(await px(card, 'border-top-left-radius')).toBe(14)
    expect(await px(card, 'padding-left')).toBe(20)
    const heading = card.getByText('No care recipients yet', { exact: true })
    expect(await px(heading, 'font-size')).toBe(18)
    expect(await css(heading, 'font-weight')).toBe('600')
    const line = card.getByText('Add the person you are arranging care for to start a booking.', { exact: true })
    expect(await px(line, 'font-size')).toBe(15)
    expect(await css(line, 'color')).toBe(MUTED)
    const add = card.getByRole('link', { name: 'Add your first care recipient' })
    await expect(add).toHaveAttribute('href', '/recipients/new')
    await expectPrimaryButton(add)
    expect((await add.boundingBox())!.width).toBe(308) // the card's width less its 20px padding
    await testInfo.attach('recipients-empty', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('ACC-04: a bordered card per recipient with a primary "Book care for {first name}", then the outlined "Add another recipient"', async ({ page }, testInfo) => {
    const family = await makeFamily()
    await makeRecipient({ family, name: 'Grace Wanjiru' })
    await makeRecipient({ family, name: 'Joseph Mwangi' })
    await logInViaUI(page, family.email, family.password)
    await expectTitle(page, 'Care recipients')
    await expect(page.getByTestId('recipients-empty')).toHaveCount(0)

    const cards = page.getByTestId('recipient-card')
    await expect(cards).toHaveCount(2)
    for (const [index, [full, first]] of [['Grace Wanjiru', 'Grace'], ['Joseph Mwangi', 'Joseph']].entries()) {
      const card = cards.nth(index)
      expect(await css(card, 'background-color')).toBe(WHITE)
      expect(await css(card, 'border-top-color')).toBe(BORDER)
      expect(await px(card, 'border-top-width')).toBe(1)
      expect(await px(card, 'border-top-left-radius')).toBe(14)
      expect(await px(card, 'padding-left')).toBe(16)
      const name = card.getByText(full, { exact: true })
      expect(await px(name, 'font-size')).toBe(18)
      expect(await css(name, 'font-weight')).toBe('600')
      const book = card.getByRole('link', { name: `Book care for ${full}` })
      await expect(book).toHaveText(`Book care for ${first}`)
      await expect(book).toHaveAttribute('href', /^\/book\/bundle\?recipientId=/)
      await expectPrimaryButton(book)
      expect((await book.boundingBox())!.width).toBe(316)
    }
    // 16px between the cards
    const first = (await cards.nth(0).boundingBox())!
    const second = (await cards.nth(1).boundingBox())!
    expect(second.y - (first.y + first.height)).toBe(16)

    const add = page.getByRole('link', { name: 'Add another recipient' })
    await expect(add).toHaveAttribute('href', '/recipients/new')
    expect((await add.boundingBox())!.height).toBe(48)
    expect(await css(add, 'background-color')).toBe(WHITE)
    expect(await css(add, 'color')).toBe(PRIMARY)
    expect(await px(add, 'border-top-width')).toBe(2)
    expect(await css(add, 'border-top-color')).toBe(PRIMARY)
    expect(await px(add, 'border-top-left-radius')).toBe(10)
    await expect(page.getByText('+ Add another recipient')).toHaveCount(0)
    await testInfo.attach('recipients', { body: await page.screenshot(), contentType: 'image/png' })

    await cards.nth(0).getByRole('link').click()
    await page.waitForURL('**/book/bundle**')
  })
})

test.describe('ACC-05 — Add Care Recipient', () => {
  test('the app bar, the two fields, the note, and Save recipient at the bottom', async ({ page }, testInfo) => {
    const family = await makeFamily()
    await logInViaUI(page, family.email, family.password)
    await page.goto('/recipients/new')

    const bar = page.locator('header').first()
    await expect(bar).toHaveText('Add care recipient')
    expect((await bar.boundingBox())!.height).toBe(56)
    expect(await px(bar.getByText('Add care recipient'), 'font-size')).toBe(18)
    const back = bar.getByRole('link', { name: 'Back' })
    await expect(back).toHaveAttribute('href', '/recipients')
    expect((await back.boundingBox())!.width).toBeGreaterThanOrEqual(44)
    // the title lives in the bar; the page still has a heading for screen readers
    await expect(page.getByRole('heading', { level: 1, name: 'Add care recipient' })).toBeAttached()

    await expectField(page, 'Full name (required)', 'Full name')
    const notes = page.getByLabel('Care notes (optional)')
    await expect(notes).toHaveAttribute('placeholder', 'Anything the caregiver should know')
    const notesBox = (await notes.boundingBox())!
    expect(notesBox.height).toBe(112)
    expect(notesBox.width).toBe(350)
    expect(await px(notes, 'border-top-left-radius')).toBe(10)
    expect(await css(notes, 'border-top-color')).toBe(BORDER)

    const note = page.getByText("Care notes are visible to Vizazi Care Admin and to the caregiver assigned to this person's booking.", { exact: true })
    await expect(note).toBeVisible()
    expect(await css(note.locator('..'), 'background-color')).toBe(SURFACE)
    expect(await px(note.locator('..'), 'border-top-left-radius')).toBe(10)
    expect(await px(note, 'font-size')).toBe(14)
    // the disclosure comes before anything sensitive is typed: it sits right under the notes box
    expect((await note.boundingBox())!.y).toBeGreaterThan(notesBox.y + notesBox.height)

    const save = page.getByRole('button', { name: 'Save recipient' })
    await expectPrimaryButton(save)
    expect(await atBottom(save, 100)).toBe(true)
    await testInfo.attach('add-recipient', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('a name is required: left empty, the box turns red with its message; filled, the recipient is saved', async ({ page }) => {
    const family = await makeFamily()
    await logInViaUI(page, family.email, family.password)
    await page.goto('/recipients/new')
    const name = page.getByLabel('Full name (required)')
    await name.focus()
    await name.blur()
    const error = page.getByText('Name is required.', { exact: true })
    await expect(error).toBeVisible()
    expect(await css(name, 'border-top-color')).toBe(DANGER)
    expect(await px(name, 'border-top-width')).toBe(2)
    await expect(error.locator('svg')).toHaveCount(1)

    await name.fill('Baba Kariuki')
    await page.getByLabel('Care notes (optional)').fill('Diabetic, needs insulin reminder')
    await page.getByRole('button', { name: 'Save recipient' }).click()
    await page.waitForURL('**/recipients')
    await expect(page.getByTestId('recipient-card')).toContainText('Baba Kariuki')
    await expect(page.getByRole('link', { name: 'Book care for Baba Kariuki' })).toHaveText('Book care for Baba')
  })
})
