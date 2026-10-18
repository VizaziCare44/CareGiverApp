# Running the tests

One command runs everything from a clean database:

```bash
npm run e2e:fresh
```

It (1) resets the **local** Supabase database from the migrations, (2) seeds the starter set, then (3) runs Playwright. CI runs exactly this command, so a green run on your machine means the same thing as a green run on GitHub.

## What you need once

- Node 22 and `npm install` (then `npx playwright install chromium`).
- The Supabase CLI (`supabase --version`) and Docker running.
- The local stack started from the `backend-config` folder: `cd backend-config && supabase start`. Leave it running.

That is all. You do **not** need `.env.local` for this: the wrapper reads the local stack's address and keys from `supabase status`, and it does not read `.env.local`, so it cannot touch the dev project by accident.

## Options

```bash
npm run e2e:fresh -- --dry-run               # print what it would do, change nothing
npm run e2e:fresh -- --seed accounts         # seed only these modules (comma separated)
npm run e2e:fresh -- --no-reset              # keep the database as it is (local only)
npm run e2e:fresh -- --grep "route guarding" # anything else goes to Playwright
```

Seed modules are listed in `scripts/seed/modules.mjs`. Today there is one, `accounts`: 9 profiles (admin1, cg1 to cg3, fm1 to fm5), 5 care recipients and 8 bookings, on `…@test.vizazicare.example` addresses.

## The passwords

The seeded accounts share one password, `SEED_TEST_PASSWORD`. If you do not set it, each run makes up its own and keeps it nowhere; it is never in the repository and never printed. Tests that need a password for an account they make themselves use their own.

## Writing a test

- Make your own data with the factories (`tests/e2e/factories.ts`): `makeFamily()`, `makeCaregiver({ verified })`, `makeRecipient()`, `makeBooking({ status, caregiver })`. They use the service role to set data up only; check permissions through a real session.
- To act as a seeded person, `test.use({ storageState: personaState('fm3') })` (`tests/e2e/personas.ts`). Each persona is signed in once before the run. Only read what a persona owns; a test that changes shared rows would disturb the others.
- A test that uses neither gets a fresh, signed-out browser: right for Log In, Sign Up and logout.

## The dev project (the fallback)

If the local stack is not an option, `npm run e2e:fresh -- --dev-fallback` runs against the dev project named in `.env.local`. **It never resets the dev project**: the seed is idempotent and never deletes, so a second run is safe, but every test leaves its accounts and bookings behind. Prefer the local stack.

## What it will not do

It refuses, before anything runs, any database that is not the local stack or the dev project (`scripts/seed/allow-list.mjs`). **Production is never on that list.** It resets only the local stack, never any hosted project.
