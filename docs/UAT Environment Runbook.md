# UAT environment runbook (pre-pilot user acceptance testing)

**Who runs this:** the Tech Lead, hands-on, because it needs the Vercel and Supabase dashboards and the service-role key. David wrote the definition and the account script.
**Source:** DEV-053 (FD-VERIFY §7.8(l), §7.8(m); Test_Data_Strategy.md §9(b), which I could not read: see "Not covered"). Depends on DEV-024 (CI), DEV-025 (deploy gate) and, for staged data, DEV-051.
**Status:** written, **not yet run**. Nothing below has been done on Vercel or in the Supabase dashboard. The facts in "What is true today" were read on 2026-10-17.

## What UAT is here

A small group of named people (the founder, the pilot caregivers' contacts, anyone the founder invites) use the real app, in a browser, on a **stable address that is not production**, against the **dev Supabase project** (`fzkwbajawfircwfzwbjg`), with test accounts and no real data. The app is a Vercel **preview** deployment of a long-lived branch called `uat`, so UAT never touches `main`, the production deploy gate or the production project.

```
GitHub VizaziCare44/CareGiverApp, branch uat
   -> Vercel preview deployment (stable branch address, "Anyone with the link")
      -> dev Supabase project fzkwbajawfircwfzwbjg  (frozen schema during the window)
```

## Rules

- **UAT uses the dev project only. Production is never involved.** The account script refuses any other project.
- **The service-role key stays on the Tech Lead's own machine** (in `.env.local`). Vercel Preview gets the project URL and the anon key only, never the service-role key. It never goes in a chat or an email.
- **No real data in UAT.** Accounts are `uat-<name>@test.vizazicare.example`; testers are told not to enter real names, phone numbers, addresses or care notes.
- **No migration runs on the dev project from the end of 21 Oct until the UAT ends** (the freeze, item 6).
- Dates are **to confirm** with the founder and the Tech Lead: environment ready Fri 16 Oct (already past), freeze from the end of 21 Oct, UAT window 22 to 27 Oct.

## What is true today (read 2026-10-17)

| Fact | How it was read | Result |
|---|---|---|
| The dev project is running (not paused) | its auth settings answer, and `supabase migration list` connects | **running** |
| The dev project has every migration | `supabase migration list` | **0001 to 0010 applied** |
| Email confirmation on the dev project | `GET <project url>/auth/v1/settings`, field `mailer_autoconfirm` | **`false`: confirmation is ON** |
| Email confirmation in the local test stack | `backend-config/supabase/config.toml`, `enable_confirmations` | **`true` (ON)**, set to match dev |
| Vercel builds of `care-giver-app` | GitHub's deployment records | **every one fails** (cause unknown to me) |

Two of these block UAT as the ticket describes it:

1. **Item 8 is not true today.** The ticket and §7.8(m) say dev has email confirmation OFF. It is ON. With it ON a new sign-up gets no session until the link in a confirmation email is followed, and the built-in Supabase email service is limited (see the provisioning runbook), so a UAT tester who signs up would be stuck. The app handles both settings (with it OFF a new sign-up goes straight to the Care Recipient List), so the fix is the setting, in item 8.
2. **The Vercel build fails**, so no preview of `uat` would reach Ready until the Vercel project is fixed (the same blocker as the production release). Read the build log first: `npx vercel inspect <deployment> --logs`, from the `vizazicare-2135` account.

## The steps, with what proves each one

### 1. Connect the repo to Vercel previews, with the dev project's variables

In the Vercel project `care-giver-app`, Settings, Environment Variables, add for the **Preview** environment (optionally limited to the branch `uat`):

- `NEXT_PUBLIC_SUPABASE_URL` = `https://fzkwbajawfircwfzwbjg.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the dev project's anon key

Nothing else. **Never the service-role key.** The repository's `vercel.json` turns off Vercel's own deploy only for `main`, so a push to any other branch, `uat` included, still gets a preview automatically.

*Proof:* the Preview environment lists those two variables and nothing that holds a secret; the first `uat` deployment (step 2) builds with them.

### 2. Create the long-lived `uat` branch and note its stable address

From a checkout of `VizaziCare44/CareGiverApp`, as the `VizaziCare44` account:

```bash
git fetch origin
git switch -c uat origin/main
git push -u origin uat
```

A push to `uat` runs the Playwright tests in CI but **cannot trigger the production deploy**: that job runs only for `main`. Vercel builds a preview; its Domains list on the deployment shows the stable branch address (it stays the same across pushes to `uat`). Write it down. Keep `uat` moving by merging `main` into it, and only from the end of the freeze onward for fixes the founder asks for.

*Proof:* `git ls-remote origin uat` shows the branch; the deployment's Domains list has a branch address; opening it shows the app's log-in page (once the build works).

### 3. Add that address to the dev project's Auth redirect allow-list

Supabase dashboard, dev project, Authentication, URL Configuration: add `https://<the uat branch address>/**` to the redirect URLs. Without it the links in Supabase's emails (password reset, and the confirmation link if confirmation stays on) cannot send a tester back to the UAT site.

*Proof:* the list shows the address.

### 4. Make the shareable link, and agree who holds it

On the `uat` deployment in Vercel, use **Share** to create the "Anyone with the link" link, so people outside the Vercel team can open the preview. **Check the Vercel plan allows enough shareable links: the Hobby plan allows one in total.** Check how long the link lasts and whether it can be renewed (TO CONFIRM in Vercel's current docs), because a link that expires mid-window needs a named person to renew it. **Agree who holds it**: the founder and the Tech Lead, written here once agreed: ______.

*Proof:* the link opens the app from a private browser window with no Vercel login.

### 5. Check the dev project is not paused, again just before UAT week

The dev and VizaziMain projects were both found paused on 2026-10-12. Right before the window:

```bash
supabase link --project-ref fzkwbajawfircwfzwbjg      # from backend-config
supabase migration list                               # connects; 0001 to 0010 under Local and Remote
```

and the dashboard shows the project Active. If it is paused, restore it first (a paused project cannot be freed by the app).

*Proof:* both commands succeed and the dashboard shows Active.

### 6. Freeze the dev schema

From the end of 21 Oct until the UAT ends, **no migration is applied to the dev project** and nobody runs `supabase db push` with the dev project linked. CI is unaffected (it uses a throwaway local database). If a fix needs a migration, it waits, or the founder and the Tech Lead decide to break the freeze and tell the testers.

*Proof:* `supabase migration list` at the start and at the end of the window shows the same migrations.

### 7. Create the UAT accounts

On the Tech Lead's machine, in the app folder, with `.env.local` pointing at the dev project (`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`). One command per person:

```bash
npm run create-uat-account -- --name peter                       # a Family Member (the default)
npm run create-uat-account -- --name achieng --role caregiver
npm run create-uat-account -- --name admin1 --role admin
```

Each makes `uat-<name>@test.vizazicare.example` with its **own random password**, shown once and kept nowhere (hand it to that one person over a secure channel). No phone number, no real data. The account is confirmed, so it can log in whether confirmation is on or off. The script **refuses any project except the local stack and the dev project, before it connects**, and says why. If the name already exists it says so and points at `npm run reset-password -- --email uat-<name>@test.vizazicare.example`. It is run for real in CI (`tests/e2e/uat-accounts.spec.ts`).

A caregiver is **not Verified** when created: before the first assignment, log in as the UAT admin, open Caregivers and mark them Verified with a note, the same as the real pilot (see `docs/Account Provisioning Runbook.md`, step 3).

*Proof:* the accounts can log in and land on their own screens: a family on Care recipients, a caregiver on My assignments, an admin on the Booking queue.

### 8. Make dev's email confirmation OFF, and check a new sign-up reaches the Care Recipient List

**It is ON today** (see above). In the Supabase dashboard, dev project, Authentication, Sign In / Providers, Email: turn **Confirm email** off (the label depends on the dashboard version). Then:

```bash
curl -s https://fzkwbajawfircwfzwbjg.supabase.co/auth/v1/settings -H "apikey: <the dev anon key>"
```

The answer must contain `"mailer_autoconfirm": true` (confirmation off). Then sign up once on the `uat` address with a throwaway address and confirm it lands on **Care recipients**; delete that account afterwards (Authentication, Users).

> **Before turning it off, a decision for the founder and the Tech Lead.** The local test stack (`config.toml`) and the sign-up tests assume confirmation ON ("Matches the hosted dev project"), and the sign-up screen has a "Check your email" state for it. If §7.8(m) means OFF everywhere, the stack's setting and those tests need changing to match, as a separate task; otherwise dev (OFF) and CI (ON) test different behaviour. This runbook does not change either.

*Proof:* the `curl` shows `mailer_autoconfirm: true` and the throwaway sign-up reaches Care recipients.

## Data on the dev project

UAT runs on the dev project, which still holds data left from development: bookings, family accounts and test Admin accounts. UAT testers will see some of it (for instance the Admin booking queue lists every request). Decide before the window whether to leave it, or clear it so UAT starts clean. Deleting is irreversible for accounts that took part in verification or assignment (their history is permanent by design); see the provisioning runbook, "Retiring an account". **Staged UAT data** (a set of bookings and caregivers in known states for the testers to work through) is not built: it needs the starter-set seed (DEV-054) and Test_Data_Strategy.md; the factories of DEV-051 can create such data in tests but are not a UAT staging script.

## After the UAT

- Remove or ban the UAT accounts (`uat-*@test.vizazicare.example`); those with no history can be deleted in the dashboard.
- Revoke the shareable link and stop the `uat` branch's Preview environment variables if no further round is planned.
- End the freeze, in writing.

## Not covered

- **Test_Data_Strategy.md §9(b)** is referred to by the ticket but I could not find the document in the repository, in Linear or on this machine; if it says more about UAT than the ticket does, this runbook should be checked against it.
- **UAT scenarios and acceptance criteria** (what the testers do, who signs off) are not in this ticket and are not written here.
