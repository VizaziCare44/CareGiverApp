# Production release runbook (database migrations and the production environment)

**Who runs this:** the Tech Lead, who holds the production Supabase project and the Vercel project. David wrote the migration list and checks (part A); the production steps (part B) and the rehearsal (part C) are the Tech Lead's.
**Source:** DEV-052 (FD-VERIFY §7.7, §7.8(g), §7.8(m)); depends on DEV-025 (deploy gate), DEV-034 (the last migration) and DEV-035 (account provisioning runbook).
**Status:** written, **not yet rehearsed**. Nothing in this runbook has been run against a production project. The checks in part A *have* been run in CI on a database that has all ten migrations (`backend-config/supabase/tests/database/0011_release_checks.test.sql`), so a wrong answer on production means production differs from what CI built, not that the query is wrong.

## Rules

- **Migrations are applied by hand, by one person, after the Playwright run on the commit being released has passed.** Nothing applies a migration automatically.
- **The service-role key never goes into Vercel** (Preview or Production), a chat or an email. Vercel gets the project URL and the anon key only.
- **Never run `supabase db reset`, or anything that deletes data, against a hosted project.**
- Before every command, check which project you are about to change (see "Check the target" below). A migration applied to the wrong project cannot be quietly taken back: the history tables are append-only by design.
- Production is a **separate** Supabase project from the dev project (`fzkwbajawfircwfzwbjg`). Which project that is, and its plan, is a founder decision (§7.8(g)(ii), open: see "Open points").

## Check the target

From a checkout of `VizaziCare44/CareGiverApp`, folder `backend-config`:

```bash
supabase link --project-ref <the production project ref>
supabase migration list
```

The `Remote` column must show the project you mean (the link prints its ref), and on a new production project it must be empty. Read the ref aloud against the dashboard URL before continuing.

---

# Part A. The migrations, in order, with the check after each

Files are in `backend-config/supabase/migrations/`. They are applied in file-name order. The **check** for each is a query to run in the Supabase SQL editor (as the project's owner) after that migration is applied. Every check returns one value; the expected value is in the right-hand column. The checks stay true after later migrations are applied, so on a new project you can apply all ten and then run every check in order (the way CI does).

## How to apply

On a **new, empty** production project (the first release), after CI is green on the commit:

```bash
supabase db push --dry-run     # lists what it would apply: all ten, 0001 to 0010, nothing else
supabase db push               # applies them in order
supabase migration list        # Local and Remote columns both show 0001 to 0010
```

Then run the checks below, in order. If a check fails, **stop** and do not continue to the next step; see "Reverse steps".

For a later release that adds one migration, `db push` applies just that one: run its check straight after.

> If a migration is ever applied to a project that already holds bookings, first run the DEV-028 check query. Migration 0005 adds a rule (`bookings_status_caregiver_check`) that fails to apply if any booking breaks it. On a new project this returns nothing:
>
> ```sql
> select id, status, assigned_caregiver_id from public.bookings where status <> 'requested' or assigned_caregiver_id is not null;
> ```

## The list

### 0001 `init`: the base schema (FD-ACC, DEV-004 to DEV-006)

Creates `profiles`, `care_recipients`, `bookings`, the three enums (`user_role`, `bundle_code`, `booking_status`) and the trigger that makes a profile row when someone signs up.

| Check | Expect |
|---|---|
| `select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('profiles', 'care_recipients', 'bookings');` | `3` |
| `select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname in ('user_role', 'bundle_code', 'booking_status');` | `3` |
| `select count(*) from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal;` | `1` |

Reverse step: none written. This is the base; on a project where it has just been applied, drop the project and start again.

### 0002 `rls`: row-level security (FD-ACC, DEV-007)

Turns row-level security on for the three tables, adds the family and Admin policies and the `current_user_role()` helper. This is the real access boundary, not the app's route guard.

| Check | Expect |
|---|---|
| `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('profiles', 'care_recipients', 'bookings') and c.relrowsecurity;` | `3` |
| `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'current_user_role';` | `1` |

Reverse step: none written (see 0001).

### 0003 and 0004 `harden_rpc_exposure`: who may call the two helper functions

0003 revoked execute from the `public` pseudo-role; 0004 revoked the separate grants Supabase gives `anon` and `authenticated`. Apply both; the check is for the pair.

| Check | Expect |
|---|---|
| `select has_function_privilege('anon', 'public.handle_new_user()', 'execute');` | `false` |
| `select has_function_privilege('authenticated', 'public.handle_new_user()', 'execute');` | `false` |
| `select has_function_privilege('anon', 'public.current_user_role()', 'execute');` | `false` |
| `select has_function_privilege('authenticated', 'public.current_user_role()', 'execute');` | `true` (the policies need it) |

Reverse step: none written (re-granting would only re-open an exposure).

### 0005 `verification_schema_and_role_hardening` (DEV-029, with the role fix from the DEV-028 audit)

Adds `caregiver_verifications` and `booking_assignments` (append-only), `bookings.assigned_by` / `assigned_at`, the status/caregiver rule, `private.is_verified()`, and **the role hardening: a sign-up can no longer choose its own role** (the role comes only from `app_metadata`, which only the service-role key can write; a user can no longer rewrite their own role).

| Check | Expect |
|---|---|
| `select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('caregiver_verifications', 'booking_assignments');` | `2` |
| `select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name in ('assigned_by', 'assigned_at');` | `2` |
| `select count(*) from pg_constraint where conname = 'bookings_status_caregiver_check';` | `1` |
| `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'is_verified';` | `1` |
| `select count(*) from pg_trigger where tgname = 'on_auth_user_app_metadata_changed' and not tgisinternal;` | `1` |
| `select count(*) from pg_trigger where tgname in ('caregiver_verifications_append_only', 'booking_assignments_append_only') and not tgisinternal;` | `2` |
| `select pg_get_functiondef('public.handle_new_user()'::regprocedure) like '%raw_app_meta_data%' and pg_get_functiondef('public.handle_new_user()'::regprocedure) not like '%raw_user_meta_data ->> ''role''%';` | `true` |
| `select not has_table_privilege('anon', 'public.caregiver_verifications', 'select') and not has_table_privilege('authenticated', 'public.caregiver_verifications', 'insert') and not has_table_privilege('authenticated', 'public.booking_assignments', 'insert');` | `true` |

Reverse step: in the file (run by hand; loses any history rows written). **The role hardening has no reverse on purpose:** putting the old trigger back would re-open the hole that let any signed-up user become an Admin. Do not reverse it.

### 0006 `close_bookings_write_path` (DEV-030): **has a reverse step**

A family member can now read their own bookings and create one with four columns (account, recipient, bundle, requested time) for their own recipient, and nothing else through the API. Status, caregiver and assignment fields change only inside the database functions. Review this one first; apply it before the functions of 0007/0008 are used.

| Check | Expect |
|---|---|
| `select count(*) from pg_policies where schemaname = 'public' and tablename = 'bookings' and policyname in ('bookings: family read own', 'bookings: family insert own');` | `2` |
| `select count(*) from pg_policies where schemaname = 'public' and tablename = 'bookings' and policyname = 'bookings: family CRUD own';` | `0` |
| `select has_table_privilege('authenticated', 'public.bookings', 'select') and not has_table_privilege('authenticated', 'public.bookings', 'update') and not has_table_privilege('authenticated', 'public.bookings', 'delete');` | `true` |
| `select has_column_privilege('authenticated', 'public.bookings', 'account_id', 'insert') and not has_column_privilege('authenticated', 'public.bookings', 'status', 'insert') and not has_column_privilege('authenticated', 'public.bookings', 'assigned_caregiver_id', 'insert');` | `true` |

Reverse step: in the file. **It re-opens the hole the DEV-028 audit found** (a family member could update or delete their bookings and insert one with any status or caregiver). Use it only to get back to a known state while a fix is prepared, and never leave production on it.

### 0007 `verification_functions` (DEV-031)

`verify_caregiver` and `remove_caregiver_verification`: Admin only (checked inside), one history row per call, execute for signed-in users only.

| Check | Expect |
|---|---|
| `select has_function_privilege('authenticated', 'public.verify_caregiver(uuid, text)', 'execute') and has_function_privilege('authenticated', 'public.remove_caregiver_verification(uuid, text)', 'execute') and not has_function_privilege('anon', 'public.verify_caregiver(uuid, text)', 'execute') and not has_function_privilege('anon', 'public.remove_caregiver_verification(uuid, text)', 'execute');` | `true` |

Reverse step: in the file (drops the two functions; history rows already written stay).

### 0008 `assignment_functions` (DEV-032)

`assign_booking` and `change_booking_caregiver`: Admin only, the caregiver must be Verified now, one assignment row per call.

| Check | Expect |
|---|---|
| `select has_function_privilege('authenticated', 'public.assign_booking(uuid, uuid)', 'execute') and has_function_privilege('authenticated', 'public.change_booking_caregiver(uuid, uuid)', 'execute') and not has_function_privilege('anon', 'public.assign_booking(uuid, uuid)', 'execute') and not has_function_privilege('anon', 'public.change_booking_caregiver(uuid, uuid)', 'execute');` | `true` |

Reverse step: in the file (drops the two functions; bookings and assignment rows already written stay).

### 0009 `caregiver_family_reads` (DEV-033)

A caregiver reads only the bookings assigned to them, and their recipients' care notes, only while assigned **and currently Verified**; the Admin reads the two history tables; nobody writes a profile through the API; signed-out requests cannot read care recipients.

| Check | Expect |
|---|---|
| `select has_table_privilege('authenticated', 'public.profiles', 'update');` | `false` |
| `select count(*) from pg_policies where schemaname = 'public' and policyname in ('bookings: caregiver read assigned', 'care_recipients: caregiver read assigned', 'caregiver_verifications: admin read', 'booking_assignments: admin read');` | `4` |
| `select has_table_privilege('anon', 'public.care_recipients', 'select');` | `false` |

Reverse step: in the file. It restores a user's right to change their own name and phone; it does not restore any way to change a role.

### 0010 `views` (DEV-034)

`caregiver_overview`, `admin_booking_overview` (Admin only) and `family_bookings` (a family's own bookings, with the caregiver's name only when the rules allow it, and nothing else about the caregiver).

| Check | Expect |
|---|---|
| `select count(*) from information_schema.views where table_schema = 'public' and table_name in ('caregiver_overview', 'admin_booking_overview', 'family_bookings');` | `3` |
| `select has_table_privilege('authenticated', 'public.family_bookings', 'select') and not has_table_privilege('anon', 'public.family_bookings', 'select') and not has_table_privilege('anon', 'public.caregiver_overview', 'select') and not has_table_privilege('anon', 'public.admin_booking_overview', 'select');` | `true` |
| `select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'family_bookings' and column_name in ('assigned_caregiver_id', 'caregiver_id', 'phone', 'email');` | `0` |

Reverse step: in the file (drops the three views). **`family_bookings` is the one view that runs with its owner's rights**, with `where b.account_id = auth.uid()` as the only barrier between one family's bookings and another's. The Tech Lead should read it before release.

### The whole database, after all ten

| Check | Expect |
|---|---|
| `select count(*) from pg_tables where schemaname = 'public' and not rowsecurity;` | `0` (every table has row-level security on) |

And `supabase migration list` shows 0001 to 0010 under both Local and Remote.

## Reverse steps: the short version

- Each of 0005 to 0010 has its reverse step written at the bottom of its file, to be run by hand, in that order reversed (0010 first). 0001 to 0004 have none.
- **A reverse step that drops a table or view loses data**, and the verification and assignment history can never be deleted by the app. Prefer a new forward migration that fixes the problem over reversing.
- **0006 is the one that must never be left reversed on production** (it re-opens a data hole); **the role hardening in 0005 is never reversed.**
- After any reverse step, re-run the checks of the migrations that remain applied.

---

# Part B. The production environment (the Tech Lead)

Do these once, in this order, for the first release. Each step says what proves it worked.

1. **Create the production Supabase project** on the free-plan slot (open point: the plan, see below). Write down its ref and its URL. *Proof:* it appears in your dashboard and `supabase link` accepts the ref.
2. **Check the email-confirmation setting is OFF** (Authentication, the Email sign-in provider; the exact label depends on the dashboard version). This is the same as the dev project and the local test stack (§7.8(m)); **production needs no mail service of its own for the Beta.** *Proof:* step 7 below.
3. **Apply the migrations** exactly as in part A, after CI is green on the commit. *Proof:* every check returns its expected value, and `supabase migration list` shows 0001 to 0010 under Remote.
4. **Create the Admin and the two pilot caregivers** with `docs/Account Provisioning Runbook.md` (DEV-035), on their real email addresses, never test emails. Mark each caregiver Verified in the app as the Admin, with a note. *Proof:* the runbook's elevated-account query lists exactly those three people:

   ```sql
   select email, role, created_at from public.profiles where role <> 'family_member' order by created_at;
   ```

5. **Set the Vercel production environment variables** (project `care-giver-app`, Environment: Production) to the production project only: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Never the service-role key.** `NEXT_PUBLIC_*` values are baked in at build time, so the change takes effect only after the next production build (step 6). The app's content security policy also follows `NEXT_PUBLIC_SUPABASE_URL`, so a wrong URL shows up as a blocked request, not only as a failed login. *Proof:* the list of variables on the Production environment has those two and nothing that holds a secret.
6. **Deploy through the gate.** Production deploys only through the deploy hook that the GitHub Actions job `deploy-production` calls after the tests pass (DEV-025): push the release commit to `main` and wait for the job to go green. Do not deploy by another route. *Proof:* a new production deployment in Vercel with state Ready, for the release commit.
7. **Smoke tests on the production address** (the first account is one you delete afterwards):
   - Sign up a new family account. It reaches **Care recipients** with no email step (this proves step 2). Delete that test account in the dashboard (Authentication, Users) when done.
   - Log in as the Admin: you land on the **Booking queue**.
   - Log in as each pilot caregiver: you land on **My assignments** (empty).
   - As the family account, add a recipient and request a booking; as the Admin, see it in the queue, assign a Verified caregiver; as that caregiver, see it in My assignments, with the care notes; as the family, see the caregiver's name on the booking.
   - Delete the test recipient, booking and account only if the Admin created them as a test (accounts with history cannot be deleted; ban them instead, see the provisioning runbook).

## Open points before the first release

- **The plan for the production project** (founder, §7.8(g)(ii)). Not decided here.
- **Which project becomes production** is not yet decided either. As of 2026-10-17 the live site still points at the VizaziMain project, which was paused; all development has been done against the dev project `fzkwbajawfircwfzwbjg`.
- **The Vercel build currently fails** for every deployment of `care-giver-app` (found 2026-10-17; the cause is not known: the app builds in CI and locally, so it is the Vercel project's setup, most likely its environment variables). Until a deployment reaches Ready, step 6 cannot succeed. Read the build log first (`npx vercel inspect <deployment> --logs`).
- **Accounts for the real pilot** are made with the provisioning runbook; read its "Things to settle" section before the release window. Until a change-password screen exists, a person's temporary password is their password.
- **Test accounts on the dev project** (leftover Admin and family accounts from testing) must not be copied to production; production starts empty.

---

# Part C. The rehearsal (before the release window)

Do **one full run of part B** on a project that is not production, with the same commit, in the same order, writing down the time each step took and every surprise. The point is to find the step that does not work as written before it matters.

- Use a project whose keys are never used by the live site. Throw it away afterwards.
- Run part A's checks and part B's smoke tests, and also the **reverse step of 0010 and then the check of 0009**, once, so the reverse steps have been seen to work.
- Update this runbook with what the rehearsal showed, then mark its Status line as rehearsed, with the date and who ran it.

# After the release

- Keep the commit hash that was released, the date, and the output of `supabase migration list`.
- If something is wrong: **do not reverse a migration to fix an app problem.** Promote the previous successful production deployment in Vercel (TO CONFIRM with the Tech Lead how this is done with the deploy hook) and fix forward.
