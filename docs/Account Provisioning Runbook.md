# Account provisioning runbook (Admin and Caregiver accounts)

**Who runs this:** the Tech Lead or the founder, whoever holds the Supabase service-role key.
**Source:** DEV-009 (Admin accounts), DEV-035 (this runbook, extended to caregivers); FD-ACC §7.4; FD-VERIFY §5.7(b), BR-004, BR-012.

## Rules

- Only Family Members sign up in the app. **Admin and Caregiver accounts are created only by the steps below.** There is no public signup for them and no creation screen.
- The role is set by the `--role` flag, through `app_metadata`, which only the service-role key can write. It is never read from sign-up data, and a signed-in user cannot change their own role (the database refuses it).
- One person, one account, on that person's real email address. Never use test emails or the Playwright test password, and never create an account at `/sign-up` and promote it afterwards.
- The service-role key stays in your own `.env.local`. It never goes into Vercel (Preview or Production), a chat, or an email.

## Before you start (once per project)

1. Check which project you are about to change. The scripts print `Project: <host>` first; confirm it is the one you intend (today `fzkwbajawfircwfzwbjg.supabase.co`).
2. Check that migration 0005 or later is applied there: from your `backend-config` checkout, `supabase migration list` shows it under "remote". Without 0005 an account comes out as a family member; the script notices and tells you.
3. `.env.local` in the app folder holds `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for that project.

## 1. Create the Admin account

```bash
npm run provision-account -- --role admin --email jane@example.com --name "Jane Doe" --phone "+254700000000"
```

The account is confirmed immediately (no email needed). The script prints a one-time temporary password; it is not stored anywhere.

## 2. Create the two pilot caregivers

Run once per caregiver:

```bash
npm run provision-account -- --role caregiver --email caregiver@example.com --name "Achieng Otieno" --phone "+254700000001"
```

A new caregiver is **not Verified**. The system will not let an Admin assign an unverified caregiver, so do step 3 before the first assignment.

## 3. Mark each caregiver Verified (before the first assignment)

Done in the app, by the Admin, never by script:

1. Log in as the Admin, open **Caregivers**, open the caregiver.
2. Choose **Mark as Verified** and write a note saying what was checked (for example "Met in person; two references called"). The note is required and is kept in the history with your name and the time.
3. Confirm. The caregiver now shows **Verified** and can be assigned.

No ID number, ID image or background-check document is stored anywhere (AC-017). The note describes what was checked, not the documents.

> **Status:** the Caregivers screens and the Mark as Verified dialog are built (DEV-036 to DEV-039, in review). The rule is also enforced in the database: an unverified caregiver cannot be assigned, and Verified or not is always the latest entry in the history.

## 4. Hand over the login

Give the person the email and the temporary password in person or through a password manager's share feature. Do not send the password by email or in a chat message in plain text.

**Known gap:** there is no change-password screen in the app. A person can choose their own password only through **Forgot password** on the log-in page, which relies on email delivery (see below). Until that is settled, the temporary password is the account's password; treat it as one, and reset it (next section) if it has been seen by anyone else.

## Reset a password by hand (TO CONFIRM with the Tech Lead)

For any account, family member, caregiver or Admin. Self-service recovery exists but needs email delivery to work, and the Admin's login is the key to verification, so keep this route.

```bash
npm run reset-password -- --email jane@example.com
```

It sets a new random password and prints it once. Hand it over as in step 4.

## Checking the list of elevated accounts

After creating accounts, and again before the pilot opens, list every account that is not a family member (Supabase Studio, SQL editor):

```sql
select email, role, created_at from public.profiles where role <> 'family_member' order by created_at;
```

It should contain exactly the people you expect and no test accounts. At the time of writing the dev project still holds 21 leftover test Admin accounts; delete them before real families sign up.

## Retiring an account

- An account that has taken part in verification or assignment cannot be deleted: those history rows are permanent by design. To stop someone logging in, use **Authentication > Users > Ban user** in the Supabase dashboard. For a caregiver, also **Remove Verified** in the app, which takes their bookings and the care notes away from them immediately.
- An account with no history (a mistake, a test) can be deleted in the dashboard under **Authentication > Users**.

## Things to settle (for the production rehearsal, DEV-052)

- A change-password screen, or a decision that the temporary password is acceptable for Beta.
- Email delivery for **Forgot password** and for family sign-up confirmation. As I understand Supabase's built-in email service, it only delivers to members of the Supabase project's own team and is rate-limited, so real families will need a custom email provider. Check the current Supabase docs before relying on it.
- A signed-in caregiver lands on **My assignments** (DEV-047, in review).
- The production release steps, including the rehearsal this section was written for, are in `docs/Production Release Runbook.md` (DEV-052).
