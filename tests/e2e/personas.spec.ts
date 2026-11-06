import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { PERSONAS, personaState, personasAvailable } from './personas'

// DEV-055: persona sessions work. Each seeded user is signed in once before the run
// and a test can run as that person; a test that does not ask gets a fresh
// signed-out browser. They only read: see personas.ts.

test.skip(!personasAvailable, 'SEED_TEST_PASSWORD is not set: the starter set is not seeded, so there are no persona sessions')

test.describe('DEV-055 — persona sessions', () => {
  test('every seeded user has a saved, signed-in state', () => {
    expect(PERSONAS.map((p) => p.key)).toEqual(['admin1', 'cg1', 'cg2', 'cg3', 'fm1', 'fm2', 'fm3', 'fm4', 'fm5'])
    for (const persona of PERSONAS) {
      const state = JSON.parse(fs.readFileSync(personaState(persona.key), 'utf8')) as { cookies: { name: string }[] }
      // the Supabase session cookie is what makes the browser signed in
      expect(state.cookies.some((cookie) => cookie.name.startsWith('sb-')), persona.key).toBe(true)
    }
  })

  test('a test with no persona gets a fresh signed-out browser', async ({ page }) => {
    await page.goto('/recipients')
    await page.waitForURL('**/log-in')
  })

  test.describe('as fm3 (one recipient with blank care notes, two bookings: B5 assigned and B8 cancelled)', () => {
    test.use({ storageState: personaState('fm3') })

    test('lands in the family area and sees only their own recipient and bookings', async ({ page }) => {
      await page.goto('/')
      await page.waitForURL('**/recipients')
      await expect(page.getByText('Test Recipient 3A', { exact: true })).toBeVisible()
      await expect(page.getByText('Test Recipient 1A')).toHaveCount(0)

      await page.goto('/bookings')
      const bookings = page.getByRole('listitem')
      await expect(bookings).toHaveCount(2)
      // soonest first: B5 (three days out, 14:00) then B8 (cancelled, further out)
      await expect(bookings.first()).toContainText('Test Recipient 3A')
      await expect(bookings.first()).toContainText("Doctor's Day Out")
      await expect(bookings.first()).toContainText('14:00 EAT')
      await expect(bookings.first()).toContainText('Caregiver assigned')
      await expect(bookings.last()).toContainText('MediCheck')
      await expect(bookings.last()).toContainText('Cancelled')
    })
  })

  test.describe('as fm4 (the long care note, a visit in progress and a completed one)', () => {
    test.use({ storageState: personaState('fm4') })

    test('sees their own two bookings, in progress first and completed last, different from fm3', async ({ page }) => {
      await page.goto('/bookings')
      const bookings = page.getByRole('listitem')
      await expect(bookings).toHaveCount(2)
      await expect(bookings.first()).toContainText('Test Recipient 4A')
      await expect(bookings.first()).toContainText('MediCheck')
      await expect(bookings.first()).toContainText('In progress')
      await expect(bookings.last()).toContainText('Test Recipient 4A')
      await expect(bookings.last()).toContainText('Completed')
      await expect(page.getByText('Test Recipient 3A')).toHaveCount(0)
    })
  })

  test.describe('as fm5 (no recipients, no bookings)', () => {
    test.use({ storageState: personaState('fm5') })

    test('sees the first-time empty states', async ({ page }) => {
      await page.goto('/recipients')
      await expect(page.getByText('Add your first care recipient to get started.')).toBeVisible()
      await page.goto('/bookings')
      await expect(page.getByText("You haven't requested a booking yet.")).toBeVisible()
    })
  })

  test.describe('as admin1', () => {
    test.use({ storageState: personaState('admin1') })

    test('lands on the Booking queue and sees the seeded requests', async ({ page }) => {
      await page.goto('/')
      await page.waitForURL('**/admin/queue')
      await expect(page.getByRole('heading', { name: 'Booking queue' })).toBeVisible()
      // the requests that stay requested whatever else is seeded: B1 (1A, MediCheck) and B2 (1B, Doctor's Day Out)
      await expect(page.getByText('Recipient: Test Recipient 1A')).toBeVisible()
      await expect(page.getByText('Recipient: Test Recipient 1B')).toBeVisible()
    })
  })

  test.describe('as cg3 (a Caregiver who is Not verified, with nothing assigned)', () => {
    test.use({ storageState: personaState('cg3') })

    test('lands on My assignments, empty', async ({ page }) => {
      await page.goto('/')
      await page.waitForURL('**/assignments')
      await expect(page.getByText('No bookings assigned to you yet.', { exact: false })).toBeVisible()
    })
  })

  test('two personas run side by side, each in their own browser, without seeing each other', async ({ browser }) => {
    const [three, four] = await Promise.all([
      browser.newContext({ storageState: personaState('fm3') }),
      browser.newContext({ storageState: personaState('fm4') }),
    ])
    try {
      const [pageThree, pageFour] = await Promise.all([three.newPage(), four.newPage()])
      await Promise.all([pageThree.goto('/recipients'), pageFour.goto('/recipients')])
      await expect(pageThree.getByText('Test Recipient 3A', { exact: true })).toBeVisible()
      await expect(pageFour.getByText('Test Recipient 4A', { exact: true })).toBeVisible()
      await expect(pageThree.getByText('Test Recipient 4A')).toHaveCount(0)
      await expect(pageFour.getByText('Test Recipient 3A')).toHaveCount(0)
    } finally {
      await three.close()
      await four.close()
    }
  })
})
