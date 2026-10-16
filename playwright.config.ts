import { defineConfig, devices } from '@playwright/test'

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
