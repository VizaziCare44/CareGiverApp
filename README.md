# Vizazi Care — Account & Booking Flow (FD-ACC)

Implements `docs/Vizazi Care — Feature Dev Document.md` (Document ID FD-ACC, covering P0-1/P0-2/P0-3): Family Member account creation, care-recipient setup, MediCheck/Doctor's Day Out bundle selection, and booking-request submission through to Admin visibility. Scope, rules, and acceptance criteria all trace back to that document — see it for the "why" behind any decision below.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind, Supabase (Postgres + Auth + PostgREST, RLS-enforced), Playwright for E2E. Per FD-ACC §7.1.

## Local setup

1. `npm install`
2. Clone the backend-config repo (migrations/config, extracted from this repo per DEV-002): [`VizaziCare44/CareGiverApp/backend-config`](https://github.com/VizaziCare44/CareGiverApp/tree/main/backend-config).
3. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if you don't have it, then run `supabase start` from that `backend-config` checkout — spins up a local Postgres/Auth/PostgREST stack and applies `supabase/migrations/*.sql`.
4. `supabase status` prints your local `anon` and `service_role` keys. Copy this repo's `.env.local.example` to `.env.local` and fill them in.
5. `npm run dev` — app at http://localhost:3000.

## Admin and caregiver accounts

There's no public Admin or Caregiver signup and no in-app creation screen (FD-ACC §7.4, DEV-009, DEV-035): they are provisioned by hand, by whoever holds `SUPABASE_SERVICE_ROLE_KEY` (the founder or Tech Lead). The full procedure, including marking a caregiver Verified before the first assignment and resetting a password, is in [docs/Account Provisioning Runbook.md](docs/Account%20Provisioning%20Runbook.md).

```bash
npm run provision-account -- --role admin --email you@example.com --name "Jane Doe" --phone "+254700000000"
npm run provision-account -- --role caregiver --email you@example.com --name "Jane Doe" --phone "+254700000000"
npm run reset-password -- --email you@example.com
```

The role is set in `app_metadata` (writable only with the service-role key; never read from sign-up data). Migration 0005 in `backend-config` must be applied to the target project first; the script checks the resulting role and says so if it isn't.

## Testing

`npx playwright test` runs all 14 cases from `docs/VIzazi CAre - QA Test Cases Account & Booking Flow.md` (TC-ACC-001–014), named to match that table 1:1. Needs the local Supabase stack running and `SUPABASE_SERVICE_ROLE_KEY` set (used only by `tests/e2e/helpers.ts` to promote a test user to admin — never read by application code).

## Explicitly out of scope this cycle

GPS, in-app payment, automated caregiver matching, booking customization, phone-OTP signup, password recovery, PWA/offline support, SSO/MFA — see FD-ACC §3.5 and `Vizazi Care — MVP Scope (Beta Pilot Launch).md` §5. Caregiver verification/assignment, visit execution, and family visibility are separate Feature Dev documents (FD-VERIFY, FD-VISIT, FD-FAMVIS, FD-ADMINEXC) built in later sprints per `APPROVED MVP Beta Delivery Plan.md` §5–6.

## Deployed

- App: https://vizazi-care.vercel.app (Vercel project `vizazi-care`, team `quaycee1s-projects`)
- Backend: Supabase project `VizaziCare44's Project` (`fzkwbajawfircwfzwbjg`, `eu-west-1`) — provisioned/wired DEV-003, 2026-09-18. Supersedes the earlier `vizazi-care` project (`kqfnksnaoktlnffcocyf`), which is paused and no longer used by this app.

Email confirmation is required on this project (platform-level "Confirm email" setting — not something reachable via migrations). The Sign Up flow accounts for this: `signUp()` shows a "Check your email" screen when no session comes back, and `app/auth/confirm/route.ts` verifies the PKCE `token_hash` link and establishes the session (Supabase's documented pattern for this — see the route's comments).

**One unverified gap**: the actual emailed confirmation link's domain depends on this Supabase project's Auth → URL Configuration → "Site URL" setting, which is dashboard-only and wasn't reachable from here. The route handler itself was verified directly (confirmed working against a real token_hash pulled from `auth.users.confirmation_token`), so the code is correct — but if Site URL is still the Supabase-generated default rather than `https://vizazi-care.vercel.app`, real confirmation emails will link to the wrong place. Worth a one-time check in the dashboard before this goes in front of real families: **Authentication → URL Configuration → Site URL**.

## Verified end-to-end (2026-09-08)

Signed up → confirmed via the real emailed-link mechanism → added a care recipient → booked MediCheck → submitted → confirmation screen → booking appeared correctly in the Admin queue (role-promoted test admin). All test data cleaned up afterward — the pilot database is empty and ready for real families.
