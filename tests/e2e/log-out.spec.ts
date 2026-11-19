import { test, expect, type Page } from '@playwright/test'
import { createUserWithRole, logInViaUI } from './helpers'

// VIZ-201: Log out for every signed-in role. It ends this device's session only, lands on Log In, and is a same-origin
// POST (never a link), so a prefetch or another site cannot sign anyone out.

const ROLES = [
  ['family_member', '/recipients'],
  ['caregiver', '/assignments'],
  ['admin', '/admin/queue'],
] as const

const pathOf = (page: Page) => new URL(page.url()).pathname

async function signIn(page: Page, role: (typeof ROLES)[number][0], home: string) {
  const user = await createUserWithRole(role, `Logout ${role} ${Date.now()}`)
  await logInViaUI(page, user.email, undefined, `**${home}`)
  return user
}

test.describe('VIZ-201 — Log out', () => {
  for (const [role, home] of ROLES) {
    test(`${role}: Log out from their home ends on Log In, and their home then sends them back to Log In`, async ({ page }) => {
      await signIn(page, role, home)
      await page.getByRole('button', { name: 'Log out' }).click()
      await page.waitForURL('**/log-in')

      await page.goto(home)
      expect(pathOf(page)).toBe('/log-in')
      // going back in the browser does not bring the session back either
      await page.goBack()
      await page.goto(home)
      expect(pathOf(page)).toBe('/log-in')
    })

    test(`${role}: Log out is a button in a POST form, not a link, and at least 44 px high (390 and 1280 wide)`, async ({ page }) => {
      await signIn(page, role, home)
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(page.getByRole('link', { name: 'Log out' })).toHaveCount(0)
        const button = page.getByRole('button', { name: 'Log out' })
        await expect(button).toBeVisible()
        const form = page.locator('form[action="/auth/sign-out"]')
        await expect(form).toHaveCount(1)
        await expect(form).toHaveAttribute('method', 'post')
        const box = await button.boundingBox()
        expect(box!.height, `${role} at ${width} wide`).toBeGreaterThanOrEqual(44)
        // the same look as Change password where there is one (Figma "Text link (44 tap target)")
        const style = await button.evaluate((el) => {
          const s = getComputedStyle(el)
          return { color: s.color, size: s.fontSize, weight: s.fontWeight, underline: s.textDecorationLine }
        })
        expect(style.size).toBe('16px')
        expect(style.weight).toBe('600')
        expect(style.underline).toBe('underline')
      }
    })
  }

  test('only this device is signed out: a second browser for the same person stays signed in', async ({ page, browser }) => {
    const user = await signIn(page, 'family_member', '/recipients')
    const other = await browser.newContext()
    const second = await other.newPage()
    await logInViaUI(second, user.email, undefined, '**/recipients')

    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('**/log-in')

    await second.goto('/recipients')
    expect(pathOf(second)).toBe('/recipients')
    await expect(second.getByRole('heading', { level: 1, name: 'Care recipients' })).toBeVisible()
    await other.close()
  })

  test('a POST from another site is refused (403) and signs nobody out; so are a GET and a POST with no origin at all', async ({ page }) => {
    await signIn(page, 'family_member', '/recipients')

    const foreign = await page.request.post('/auth/sign-out', { headers: { Origin: 'https://evil.example' }, maxRedirects: 0 })
    expect(foreign.status()).toBe(403)

    // a cross-site request with no Origin header, only the browser's own fetch metadata
    const crossSite = await page.request.post('/auth/sign-out', { headers: { 'Sec-Fetch-Site': 'cross-site' }, maxRedirects: 0 })
    expect(crossSite.status()).toBe(403)

    // nothing says where it came from: refused
    const unknown = await page.request.post('/auth/sign-out', { maxRedirects: 0 })
    expect(unknown.status()).toBe(403)

    // a GET (a link, a prefetch, an image) is not a way to sign out
    const get = await page.request.get('/auth/sign-out', { maxRedirects: 0 })
    expect(get.status()).toBe(405)

    await page.goto('/recipients')
    expect(pathOf(page)).toBe('/recipients')
  })

  test('a same-origin POST signs out with a 303 to Log In, and asks for nothing to be cached', async ({ page, baseURL }) => {
    await signIn(page, 'caregiver', '/assignments')
    const response = await page.request.post('/auth/sign-out', { headers: { Origin: new URL(baseURL!).origin }, maxRedirects: 0 })
    expect(response.status()).toBe(303)
    expect(new URL(response.headers()['location']).pathname).toBe('/log-in')
    expect(response.headers()['cache-control']).toContain('no-store')

    await page.goto('/assignments')
    expect(pathOf(page)).toBe('/log-in')
  })

  test('Log out while already signed out is harmless: it still ends on Log In', async ({ page, baseURL }) => {
    const response = await page.request.post('/auth/sign-out', { headers: { Origin: new URL(baseURL!).origin }, maxRedirects: 0 })
    expect(response.status()).toBe(303)
    expect(new URL(response.headers()['location']).pathname).toBe('/log-in')
  })
})
