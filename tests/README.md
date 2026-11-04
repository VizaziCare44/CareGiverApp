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

Seed modules are listed in `scripts/seed/modules.mjs`; a plain run seeds `accounts`, `verification` then `visit`:

- `accounts`: 9 profiles (admin1, cg1 to cg3, fm1 to fm5), 5 care recipients and 8 bookings, all requested, on `…@test.vizazicare.example` addresses. Run on its own it is the empty state "caregivers exist and none is Verified" (`--seed accounts`).
- `verification`: on top of that, cg1 and cg2 Verified, cg3 Verified and then removed, bookings assigned (with their assignment rows), one in progress and one completed. Needs `accounts` first.
- `visit` (DEV-070): the visit of B6 (open, cg2, Medication assistance Done after one earlier entry was changed, Vitals check and Companionship not logged) and of B7 (closed, cg1, every task logged, a note about the visit, both times). Both are dated in the past in Nairobi and every time is inside the booked day. Needs `accounts` and `verification` first, and migrations 0011 to 0016. The probe (`scripts/seed/probe.mjs`) passes after it.
- `admin`: admin1 alone, nothing else: the empty state "no caregivers yet" (`--seed admin`). Not in a plain run.

(The data these modules write is a draft until it is checked against Test_Data_Strategy.md: see `scripts/seed/starter-set.mjs`.)

## The passwords

The seeded accounts share one password, `SEED_TEST_PASSWORD`. If you do not set it, each run makes up its own and keeps it nowhere; it is never in the repository and never printed. Tests that need a password for an account they make themselves use their own.

## Writing a test

- Make your own data with the factories (`tests/e2e/factories.ts`): `makeFamily()`, `makeCaregiver({ verified })`, `makeRecipient()`, `makeBooking({ status, caregiver })`. They use the service role to set data up only; check permissions through a real session.
- A visit is the exception (DEV-070): `makeVisit({ booking, caregiver, tasks, closed, visitNote })`, and `makeBooking` with the status `in_progress` or `completed`, call the real `check_in`, `log_visit_task` and `check_out` as the caregiver's own session, so the rules are the rules. The booking must be dated today in Nairobi (`nairobiDay(today)`, the default) or the clock must be set for the caregiver (`setClock`); otherwise it stops with a message and writes nothing. A caregiver can have one visit open at a time, so use a fresh `makeCaregiver` for each open visit. Tests that check in, log or check out never use the starter set's B1 to B8.
- Day-relative dates: `nairobiDay(offset, 'HH:MM')` with `yesterday`, `today` and `tomorrow` (default 09:00 EAT), computed in Africa/Nairobi.
- The test clock (`tests/e2e/visit-helpers.ts`): `setClock(caregiver, instant)`, `clearClock(caregiver)`, `countClockRows()`. It belongs to one caregiver, is written through a direct database connection (`pg`, the local stack at 127.0.0.1:54322 or `E2E_DB_URL` if that is local), and refuses any other host. Clear it in a `finally`; the last test of the suite counts the rows and expects none.
- Ground truth after an attempt (service role, never the caller of a permission case): `getChecklistItems(bundle)`, `getVisit(bookingId)`, `getVisitTasks(visitId)`, `getEntries(visitTaskId)` and `probe()`.
- To act as a seeded person, `test.use({ storageState: personaState('fm3') })` (`tests/e2e/personas.ts`). Each persona is signed in once before the run. Only read what a persona owns; a test that changes shared rows would disturb the others.
- A test that uses neither gets a fresh, signed-out browser: right for Log In, Sign Up and logout.

## The dev project (the fallback)

If the local stack is not an option, `npm run e2e:fresh -- --dev-fallback` runs against the dev project named in `.env.local`. **It never resets the dev project**: the seed is idempotent and never deletes, so a second run is safe, but every test leaves its accounts and bookings behind. Prefer the local stack.

## What it will not do

It refuses, before anything runs, any database that is not the local stack or the dev project (`scripts/seed/allow-list.mjs`). **Production is never on that list.** It resets only the local stack, never any hosted project.
