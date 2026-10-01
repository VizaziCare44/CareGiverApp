import { defineConfig, devices } from '@playwright/test'

// DEV-024: the GitHub → Playwright pipeline's quality gate. Runs against the
// shared dev Supabase project (no separate staging environment, per FD-ACC
// §10/§12) — see .github/workflows/playwright.yml for the CI secrets this
// needs (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY).
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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
