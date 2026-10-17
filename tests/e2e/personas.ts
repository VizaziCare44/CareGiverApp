import path from 'node:path'
import { homeFor, type Role } from '../../lib/route-guard'
import { ACCOUNTS } from '../../scripts/seed/starter-set.mjs'

// Persona sessions (Test_Data_Strategy.md §5; DEV-055). Before the run, the setup
// project (personas.setup.ts) signs in each seeded user ONCE, through the real Log
// In screen, and keeps the signed-in state in playwright/.auth/<key>.json. A test
// then runs as that person with one line:
//
//   test.use({ storageState: personaState('fm3') })
//
// Tests of Log In, Sign Up and logout, and any test that makes its own account,
// simply do not use it: a test with no storageState gets a fresh signed-out browser.
//
// The personas are the starter set (scripts/seed/starter-set.mjs), seeded by
// `npm run seed` with the shared password in SEED_TEST_PASSWORD. Without that
// variable no sessions are made, and `personasAvailable` is false so a spec can skip.
//
// Shared rows: a persona is a shared, fixed account, so a test must not change what
// it owns (use the factories to make rows of your own for that). The seed's own
// tests (tests/e2e/seed-accounts.spec.ts) do change the starter set and put it back;
// they run as their own Playwright project, after every other test, so they can
// never disturb a persona session in use.

export interface Persona {
  key: string
  email: string
  role: Role
  /** Where this role lands after Log In. */
  home: string
}

export const PERSONAS: Persona[] = ACCOUNTS.map((account) => ({
  key: account.key,
  email: account.email,
  role: account.role,
  home: homeFor(account.role)!,
}))

export const personasAvailable = Boolean(process.env.SEED_TEST_PASSWORD)

/** The saved signed-in state of one persona, for `test.use({ storageState })`. */
export const personaState = (key: string) => path.join('playwright', '.auth', `${key}.json`)
