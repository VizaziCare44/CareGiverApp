import { test, expect } from '@playwright/test'
import { TEST_PASSWORD, createUserWithRole, logInViaUI } from './helpers'

// Change password: a signed-in person (any role) replaces the password they have with one of their own. The current
// password is asked for and checked; the new one is at least 8 characters, different, and typed twice.

const NEW_PASSWORD = 'A-new-password-1!'

test.use({ viewport: { width: 390, height: 844 } })

async function openFromHome(page: import('@playwright/test').Page, role: 'family_member' | 'caregiver' | 'admin', home: string) {
  const user = await createUserWithRole(role, `Change ${role} ${Date.now()}`)
  await logInViaUI(page, user.email, undefined, `**${home}`)
  await page.getByRole('link', { name: 'Change password' }).click()
  await page.waitForURL('**/account/password')
  return user
}

test.describe('Change password', () => {
  for (const [role, home] of [
    ['family_member', '/recipients'],
    ['caregiver', '/assignments'],
    ['admin', '/admin/queue'],
  ] as const) {
    test(`${role}: reached from their home, the screen has the three fields and the button`, async ({ page }) => {
      await openFromHome(page, role, home)
      await expect(page.getByRole('heading', { level: 1, name: 'Change password' })).toBeAttached()
      for (const label of ['Current password', 'New password', 'Confirm new password']) {
        await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('type', 'password')
      }
      await expect(page.getByRole('button', { name: 'Save new password' })).toBeVisible()
      // the way back is the person's own home
      await expect(page.locator('header').getByRole('link')).toHaveAttribute('href', home)
    })
  }

  test('a wrong current password, a short or unchanged new one and a mismatch are each said, and nothing is saved', async ({ page }) => {
    const user = await openFromHome(page, 'family_member', '/recipients')
    const current = page.getByLabel('Current password', { exact: true })
    const next = page.getByLabel('New password', { exact: true })
    const again = page.getByLabel('Confirm new password', { exact: true })

    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByText('Enter your current password')).toBeVisible()
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()

    await current.fill(TEST_PASSWORD)
    await next.fill(TEST_PASSWORD)
    await again.fill(TEST_PASSWORD)
    await expect(page.getByText('Choose a password different from your current one')).toBeVisible()

    await next.fill(NEW_PASSWORD)
    await again.fill('something else entirely')
    await expect(page.getByText("The passwords don't match")).toBeVisible()
    await again.fill(NEW_PASSWORD)

    await current.fill('not-my-password-1')
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByText("That isn't your current password")).toBeVisible()
    await expect(page).toHaveURL(/\/account\/password$/)

    // nothing was saved: the old password still logs in
    await page.context().clearCookies()
    await logInViaUI(page, user.email, TEST_PASSWORD, '**/recipients')
  })

  test('saving: the notice, the new password logs in and the old one does not', async ({ page }) => {
    const user = await openFromHome(page, 'caregiver', '/assignments')
    await page.getByLabel('Current password', { exact: true }).fill(TEST_PASSWORD)
    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByLabel('Confirm new password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Save new password' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Password changed' })).toBeVisible()
    await expect(page.getByText('Use your new password the next time you log in.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the app' })).toHaveAttribute('href', '/assignments')

    await page.context().clearCookies()
    await page.goto('/log-in')
    await page.getByLabel('Email', { exact: true }).fill(user.email)
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible()

    await logInViaUI(page, user.email, NEW_PASSWORD, '**/assignments')
  })

  test('signed out, the address leads to Log In', async ({ page }) => {
    await page.goto('/account/password')
    await page.waitForURL('**/log-in')
  })
})
