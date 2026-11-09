import { test, expect, type Page } from '@playwright/test'
import { logInViaUI, randomEmail, TEST_PASSWORD } from './helpers'
import { makeFamily } from './factories'

// Section D of the Figma page "FD-ACC screens": ACC-13 Forgot Password, ACC-13b Forgot Password sent, ACC-14 Reset
// Password, ACC-14b Reset Password error, ACC-15 Link expired or invalid, ACC-16 Sign Up check your email (DEV-027
// and the outcomes of the email links). They are drawn from the same components as ACC-01 to ACC-05 (see
// docs/FD-ACC Section D Frame Spec.md). Measured at 390px. Colours are the Components variables.

test.use({ viewport: { width: 390, height: 844 } })

const PRIMARY = 'rgb(11, 110, 105)'
const BORDER = 'rgb(123, 135, 148)'
const SOFT = 'rgb(227, 244, 242)'
const DANGER = 'rgb(180, 35, 24)'
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

async function expectField(page: Page, label: string, placeholder: string) {
  const field = page.getByLabel(label, { exact: true })
  await expect(field).toHaveAttribute('placeholder', placeholder)
  const box = (await field.boundingBox())!
  expect(box.height).toBe(48)
  expect(box.width).toBe(350)
  expect(await css(field, 'border-top-color')).toBe(BORDER)
  expect(await px(field, 'border-top-left-radius')).toBe(10)
  const labelText = page.locator(`label[for="${await field.getAttribute('id')}"]`)
  expect(await px(labelText, 'font-size')).toBe(14)
  expect(await css(labelText, 'font-weight')).toBe('500')
  expect(await labelText.innerText()).toBe(label)
}

async function expectPrimaryButton(button: ReturnType<Page['locator']>) {
  expect((await button.boundingBox())!.height).toBe(48)
  expect(await css(button, 'background-color')).toBe(PRIMARY)
  expect(await css(button, 'color')).toBe(WHITE)
  expect(await px(button, 'border-top-left-radius')).toBe(10)
  expect(await css(button, 'font-weight')).toBe('600')
}

async function expectTextLink(link: ReturnType<Page['locator']>) {
  expect((await link.boundingBox())!.height).toBe(44)
  expect(await css(link, 'color')).toBe(PRIMARY)
  expect(await css(link, 'text-decoration-line')).toBe('underline')
  expect(await css(link, 'font-weight')).toBe('600')
}

const atBottom = async (locator: ReturnType<Page['locator']>, space = 100) => {
  const box = (await locator.boundingBox())!
  return box.y + box.height > 844 - space
}

/** The notice pattern of ACC-10: a check in a 72px soft circle, the title and the sentence centred, no app bar. */
async function expectNotice(page: Page, title: string, sentence: string | RegExp) {
  await expect(page.locator('header')).toHaveCount(0)
  const heading = page.getByRole('heading', { level: 1, name: title, exact: true })
  await expect(heading).toBeVisible()
  expect(await px(heading, 'font-size')).toBe(24)
  expect(await css(heading, 'text-align')).toBe('center')
  const text = page.getByText(sentence)
  expect(await px(text, 'font-size')).toBe(18)
  expect(await css(text, 'text-align')).toBe('center')
  expect(await css(text, 'color')).toBe(INK)
  const icon = page.locator('div[aria-hidden="true"]').first()
  const box = (await icon.boundingBox())!
  expect(box.width).toBe(72)
  expect(box.height).toBe(72)
  expect(await css(icon, 'background-color')).toBe(SOFT)
}

test.describe('ACC-13 and ACC-13b — Forgot Password', () => {
  test('ACC-13: the link under the Log In fields opens it; title, sentence, Email, Send reset link, Back to log in', async ({ page }, testInfo) => {
    await page.goto('/log-in')
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await page.waitForURL('**/forgot-password')
    expect(await css(page.locator('main'), 'background-color')).toBe(WHITE)
    await expectTitle(page, 'Reset your password')
    const sentence = page.getByText("Enter your email and we'll send you a link to reset it.", { exact: true })
    expect(await px(sentence, 'font-size')).toBe(16)
    expect(await css(sentence, 'color')).toBe(MUTED)
    await expectField(page, 'Email', 'name@example.com')
    const send = page.getByRole('button', { name: 'Send reset link' })
    await expectPrimaryButton(send)
    expect(await atBottom(send)).toBe(true)
    const back = page.getByRole('link', { name: 'Back to log in' })
    await expect(back).toHaveAttribute('href', '/log-in')
    await expectTextLink(back)
    await testInfo.attach('forgot-password', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('the Forgot password link sits under the Log In fields, left-aligned, 16px under the last one', async ({ page }) => {
    await page.goto('/log-in')
    const forgot = page.getByRole('link', { name: 'Forgot password?' })
    const password = (await page.getByLabel('Password', { exact: true }).boundingBox())!
    const link = (await forgot.boundingBox())!
    expect(link.x).toBe(20)
    expect(link.y - (password.y + password.height)).toBe(16)
    expect(link.width).toBeLessThan(350)
  })

  test('ACC-13b: the same message whichever address was typed, with a way back', async ({ page }, testInfo) => {
    await page.goto('/forgot-password')
    await page.getByLabel('Email', { exact: true }).fill(randomEmail())
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expectNotice(page, 'Check your email', /If an account exists for .*, we've sent a link to reset your password\./)
    await expectTextLink(page.getByRole('link', { name: 'Back to log in' }))
    await testInfo.attach('forgot-password-sent', { body: await page.screenshot(), contentType: 'image/png' })
  })
})

test.describe('ACC-14 and ACC-14b — Reset Password', () => {
  test('ACC-14: title, sentence, New password, Save new password at the bottom; no hint, no link', async ({ page }, testInfo) => {
    const family = await makeFamily()
    await logInViaUI(page, family.email, family.password)
    await page.goto('/reset-password')
    await expectTitle(page, 'Set a new password')
    const sentence = page.getByText('Choose a new password for your account.', { exact: true })
    expect(await px(sentence, 'font-size')).toBe(16)
    expect(await css(sentence, 'color')).toBe(MUTED)
    await expectField(page, 'New password', 'New password')
    await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('type', 'password')
    await expect(page.getByText('At least 8 characters.')).toHaveCount(0)
    const save = page.getByRole('button', { name: 'Save new password' })
    await expectPrimaryButton(save)
    expect(await atBottom(save)).toBe(true)
    await expect(page.getByRole('link')).toHaveCount(0)
    await testInfo.attach('reset-password', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('ACC-14b: a short password turns the box red on blur, with the icon and the message', async ({ page }, testInfo) => {
    const family = await makeFamily()
    await logInViaUI(page, family.email, family.password)
    await page.goto('/reset-password')
    const field = page.getByLabel('New password', { exact: true })
    await field.fill('short')
    await field.blur()
    const error = page.getByText('Password must be at least 8 characters', { exact: true })
    await expect(error).toBeVisible()
    expect(await css(error, 'color')).toBe(DANGER)
    await expect(error.locator('svg')).toHaveCount(1)
    expect(await css(field, 'border-top-color')).toBe(DANGER)
    expect(await px(field, 'border-top-width')).toBe(2)
    await field.fill('a-long-enough-password')
    await expect(error).toHaveCount(0)
    await testInfo.attach('reset-password-error', { body: await page.screenshot(), contentType: 'image/png' })
  })
})

test.describe('ACC-15 and ACC-16 — the outcomes of the email links', () => {
  test('ACC-15: Link expired or invalid, with the sentence and Go to log in at the bottom', async ({ page }, testInfo) => {
    await page.goto('/auth/auth-code-error')
    await expectTitle(page, 'Link expired or invalid')
    const sentence = page.getByText("This confirmation link didn't work. Try signing up again, or log in if you already confirmed.", { exact: true })
    expect(await px(sentence, 'font-size')).toBe(16)
    expect(await css(sentence, 'color')).toBe(MUTED)
    const go = page.getByRole('link', { name: 'Go to log in' })
    await expect(go).toHaveAttribute('href', '/log-in')
    await expectPrimaryButton(go)
    expect(await atBottom(go)).toBe(true)
    await testInfo.attach('link-expired', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('ACC-16: after Create account the confirmation notice names the address', async ({ page }, testInfo) => {
    const email = randomEmail()
    await page.goto('/sign-up')
    await page.getByLabel('Full name', { exact: true }).fill('Grace Wanjiru')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Phone number', { exact: true }).fill('+254712345678')
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expectNotice(page, 'Check your email', /We sent a confirmation link to .*\. Follow it to activate your account\./)
    await expect(page.getByText(email)).toBeVisible()
    await testInfo.attach('sign-up-check-email', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
