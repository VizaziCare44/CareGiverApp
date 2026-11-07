import { test, expect } from '@playwright/test'
import { logInViaUI } from './helpers'
import { makeFamily, makeRecipient } from './factories'

// DEV-058: the MediCheck card says "Medication assistance" (FD-VISIT §5.7(j), §6.6(b);
// Figma ACC-07 and ACC-11), and the word "administration" is on no screen. The stored
// bundle_code and every other value on the card are unchanged.

test.describe('DEV-058 — Medication assistance on the Bundle Selection card', () => {
  test('the MediCheck card lists exactly the four inclusions, and no card says "administration"', async ({ page }) => {
    const family = await makeFamily()
    const recipient = await makeRecipient({ family, name: 'Mama Wanjiku' })
    await logInViaUI(page, family.email, family.password)
    await page.goto(`/book/bundle?recipientId=${recipient.id}&recipientName=${encodeURIComponent(recipient.name)}`)

    const medicheck = page.getByTestId('bundle-card-medicheck')
    await expect(medicheck).toBeVisible()
    const inclusions = await medicheck.locator('ul').first().getByRole('listitem').allInnerTexts()
    expect(inclusions.map((item) => item.replace(/^•\s*/, ''))).toEqual([
      'Medication assistance',
      'Vitals check (blood pressure and glucose)',
      'Companionship',
      'MediCheck Report in the app',
    ])

    // the rest of the card is as it was
    await expect(medicheck.getByRole('heading', { name: 'MediCheck' })).toBeVisible()
    await expect(medicheck).toContainText('3-hour visit at home')
    await expect(medicheck).toContainText('Emergency response: under 30 minutes. Missed-medication alert: under 15 minutes.')

    expect((await page.locator('main').innerText()).toLowerCase()).not.toContain('administration')
  })

  test('choosing the card still books the same bundle', async ({ page }) => {
    const family = await makeFamily()
    const recipient = await makeRecipient({ family, name: 'Mzee Otieno' })
    await logInViaUI(page, family.email, family.password)
    await page.goto(`/book/bundle?recipientId=${recipient.id}&recipientName=${encodeURIComponent(recipient.name)}`)
    await page.getByTestId('bundle-card-medicheck').click()
    await expect(page.getByTestId('bundle-card-medicheck')).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL('**/book/datetime')
  })
})
