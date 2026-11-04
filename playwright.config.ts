import { randomBytes } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

// DEV-057: the password the tests create their accounts with is made up here, once per run,
// and handed to the workers through the environment; it is not written anywhere in the repository.
process.env.E2E_TEST_PASSWORD ??= `Tp-${randomBytes(12).toString('hex')}-Aa1!`

// DEV-024: the GitHub → Playwright pipeline's quality gate. In CI it runs
// against a temporary local Supabase stack that .github/workflows/playwright.yml
// starts from backend-config's migrations (no separate staging environment,
// per FD-ACC §10/§12). Locally it uses whatever NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY point at.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html'],
    ['@testdino/playwright', { token: process.env.TESTDINO_TOKEN }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // DEV-055: signs in each seeded persona once, before the other tests (tests/e2e/personas.ts)
    { name: 'setup', testMatch: /.*\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /seed-(accounts|verification|visit)\.spec\.ts/,
    },
    // The seed's own tests change the shared starter-set rows (passwords, roles, a booking's
    // status) and put them back, so they run on their own, after every other test, and can
    // never disturb a persona session another test is using. The accounts tests come first
    // and the verification tests after them: both change the same rows, so never together.
    {
      name: 'seed-data',
      testMatch: /seed-accounts\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['chromium'],
    },
    {
      name: 'seed-verification',
      testMatch: /seed-verification\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['seed-data'],
    },
    // DEV-070: the visit module of the seed (B6 open, B7 closed) builds on the verification rows, so
    // it runs after them, and last of all: it is where the test clock is counted at the end of the
    // suite (TC-VIS-045)
    {
      name: 'seed-visit',
      testMatch: /seed-visit\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['seed-verification'],
    },
  ],
  webServer: {
    // CI tests the production build — what's actually about to be deployed
    // — rather than next dev, which needs the dev-only CSP 'unsafe-eval'
    // widening in middleware.ts and isn't representative of prod behavior.
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
