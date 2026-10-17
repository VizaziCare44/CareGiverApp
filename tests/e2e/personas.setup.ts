import { test as setup } from '@playwright/test'
import { logInViaUI } from './helpers'
import { PERSONAS, personaState } from './personas'

// DEV-055: the persona sign-in setup. Runs once, before the other tests (the
// `setup` project in playwright.config.ts), and signs in every seeded user through
// the real Log In screen, so a test can run as fm3 or admin1 without logging in.
// Needs the starter set seeded (`npm run seed`, which CI does first) and the shared
// password in SEED_TEST_PASSWORD; without it the sign-ins are skipped, and the
// persona specs skip with them.

const password = process.env.SEED_TEST_PASSWORD

for (const persona of PERSONAS) {
  setup(`sign in as ${persona.key}`, async ({ page }) => {
    setup.skip(!password, 'SEED_TEST_PASSWORD is not set: the starter set is not seeded, so no persona sessions are made')
    await logInViaUI(page, persona.email, password!, `**${persona.home}`)
    await page.context().storageState({ path: personaState(persona.key) })
  })
}
