# FD-VISIT runbook addendum (production release: the visit migrations and checks)

**Extends:** `docs/Production Release Runbook.md` (DEV-052). Read that first: its rules, "Check the target" and "How to apply" apply here unchanged.
**Source:** DEV-071 (FD-VISIT §7.7, §7.8(a), (g)); depends on DEV-052 and DEV-059.
**Who:** David defines it; the Tech Lead runs it.
**Status:** written, **not rehearsed.** Two things are still open:

1. **The visit schema was checked against FD-VISIT section 7 on 2026-11-06 (VIZ-91).** Migrations 0011 to 0019 were written from the task texts while FD-VISIT was not available and differed from the document in many places; **migration 0020 rebuilds the visit objects in the shape the document gives**, and the checks below are those of the shape after 0020. 0011 to 0019 stay in the list because a project that has them applied still runs them in order. 0020 refuses to run if any visit exists, so it is applied on a project with no visits (dev and production are both such projects). Migrations 0011 to 0021 are **not on production**: apply the whole set at once. (0021 is FD-ADMINEXC's Exceptions view and settings, part 5; it is read-only and independent of the others.)
2. **Parts 3 and 5 are proposals for the Tech Lead's confirmation**, marked **TO CONFIRM**. The Tech Lead's confirmation of FD-VISIT §5.7(i) is still open, and the exception-settings table of FD-ADMINEXC §9 does not exist yet.

The checks in parts 1, 2 and 4, and the commands of part 3, **have been run in CI** on a database that has all twenty-one migrations (`backend-config/supabase/tests/database/0017_visit_release_checks.test.sql`). So a wrong answer on production means production differs from what CI built, not that the query is wrong. If you change a query here, change it in that test file too.

Run every query in the Supabase SQL editor **as the project's owner**, after checking which project the editor is on.

---

# Part 1. The FD-VISIT migrations, in order, with the check after each

Files are in `backend-config/supabase/migrations/`, applied in file-name order after 0001 to 0010. On a new project the whole list is applied in one `supabase db push` (21 files, 0001 to 0021); on a project that already has 0001 to 0010 it applies eleven.

```bash
supabase db push --dry-run     # lists what it would apply: 0011 to 0021 on a project that has 0001 to 0010, nothing else
supabase db push
supabase migration list        # Local and Remote both show 0001 to 0021
```

The checks below are those of the database **after all twenty-one migrations**: where 0020 rebuilt something, the check is the one for the new shape, and it sits under the migration that first created the object. **Nothing in this part writes a visit, and no migration inserts test data.** The only rows the migrations insert are the 7 `checklist_items` rows.

### 0011 `visit_schema` (DEV-059; the tables are rebuilt in the spec's shape by 0020)

Creates `checklist_items` (7 rows), `visits`, `visit_tasks`, `visit_task_entries`, the type `visit_outcome`, the rules the tables keep for themselves (a closed visit never changes; entries and snapshot rows are never updated or deleted; no entry can be added to a closed visit) and the test clock (`private.test_clock`, `private.visit_now()`). Nobody writes the visit tables except the functions (0012 to 0016, rebuilt by 0020); the Admin's read is added by 0020. No column for location, device or IP address.

| Check | Expect |
|---|---|
| `select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('checklist_items', 'visits', 'visit_tasks', 'visit_task_entries');` | `4` |
| `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('checklist_items', 'visits', 'visit_tasks', 'visit_task_entries') and c.relrowsecurity;` | `4` |
| `select not has_table_privilege('anon', 'public.visits', 'select') and not has_table_privilege('anon', 'public.visit_tasks', 'select') and not has_table_privilege('anon', 'public.visit_task_entries', 'select') and not has_table_privilege('authenticated', 'public.visits', 'insert') and not has_table_privilege('authenticated', 'public.visits', 'update') and not has_table_privilege('authenticated', 'public.visit_tasks', 'insert') and not has_table_privilege('authenticated', 'public.visit_task_entries', 'insert');` | `true` (after 0020: anon has nothing, and signed-in users cannot write; the Admin's read is by policy, next row) |
| `select count(*) from pg_policies where schemaname = 'public' and tablename in ('visits', 'visit_tasks', 'visit_task_entries');` | `3` (one "admin read" policy each; nothing else lets a signed-in user read them) |
| `select count(*) from pg_trigger where tgname in ('visits_guard', 'visit_tasks_append_only', 'visit_task_entries_append_only', 'visit_task_entries_open_visit_only') and not tgisinternal;` | `4` |
| `select count(*) from information_schema.columns where table_schema = 'public' and table_name in ('visits', 'visit_tasks', 'visit_task_entries') and column_name ~* 'location\|device\|ip_\|_ip\|latitude\|longitude\|gps\|user_agent';` | `0` |

Reverse step: in the file. **It drops the visit tables and so loses every visit written.** Run it only on a project with no real visits.

### 0012 `check_in` (DEV-060, draft)

`public.check_in(uuid)`: for a Verified Caregiver, their own booking, on the day (Africa/Nairobi), with no other visit open; opens the visit and takes the checklist snapshot.

| Check | Expect |
|---|---|
| `select has_function_privilege('authenticated', 'public.check_in(uuid)', 'execute') and not has_function_privilege('anon', 'public.check_in(uuid)', 'execute');` | `true` |

Reverse step: in the file (drops the function; visits already written stay).

### 0013 `caregiver_visit_view` (DEV-062, draft)

The Caregiver may read the checklist; the view `public.caregiver_visit` (one row per booking assigned to the signed-in, currently Verified Caregiver: the day state decided by the server's clock, the visit times, the other visit open). **The view runs with its owner's rights**, with the filter on `auth.uid()` and `private.is_verified()` as the only barrier: the Tech Lead should read it, as with `family_bookings`.

| Check | Expect |
|---|---|
| `select count(*) from pg_policies where schemaname = 'public' and tablename = 'checklist_items';` | `1` |
| `select count(*) from pg_views where schemaname = 'public' and viewname = 'caregiver_visit';` | `1` |
| `select has_table_privilege('authenticated', 'public.caregiver_visit', 'select') and not has_table_privilege('anon', 'public.caregiver_visit', 'select') and has_function_privilege('authenticated', 'private.visit_day_state(timestamptz)', 'execute') and not has_function_privilege('authenticated', 'private.visit_now()', 'execute');` | `true` |

Reverse step: in the file (drops the view, the day-state function and the checklist read rights).

### 0014 `visit_task_views` (draft)

`private.visit_task_latest` (the entry that counts for each task: the highest id; closed to every API role) and `public.caregiver_visit_tasks` (the signed-in Caregiver's visit tasks with that entry). Like 0013, an owner-rights view: read it.

| Check | Expect |
|---|---|
| `select count(*) from pg_views where (schemaname, viewname) in (('public', 'caregiver_visit_tasks'), ('private', 'visit_task_latest'));` | `2` |
| `select has_table_privilege('authenticated', 'public.caregiver_visit_tasks', 'select') and not has_table_privilege('anon', 'public.caregiver_visit_tasks', 'select') and not has_table_privilege('authenticated', 'private.visit_task_latest', 'select');` | `true` |

Reverse step: in the file (drops the two views).

### 0015 `log_visit_task` (DEV-066, draft)

`public.log_visit_task(uuid, text, text, text, text)` (0020; 0015 had a four-argument one that took a task id): adds one entry (Done with a note, or Not done with a reason); an identical repeat changes nothing. Also renames the Doctor's Day Out task "Post-visit report" to "Post-visit summary" and sets the limits to 2,000 characters (note) and 500 (reason).

| Check | Expect |
|---|---|
| `select has_function_privilege('authenticated', 'public.log_visit_task(uuid, text, text, text, text)', 'execute') and not has_function_privilege('anon', 'public.log_visit_task(uuid, text, text, text, text)', 'execute');` | `true` (the five-argument function of 0020: booking id, task key, outcome, note, reason) |
| `select (select count(*) from public.checklist_items where bundle_code = 'doctors_day_out' and name = 'Post-visit summary') + (select count(*) from public.checklist_items where name = 'Post-visit report');` | `1` |

Reverse step: in the file, **only while no entry longer than the old limits exists** (it puts the old limits and the old task name back).

### 0016 `check_out` (DEV-067, draft)

`public.check_out(uuid, text)`: closes the visit once every Required task has an outcome, and moves the booking to `completed`; sets the visit-note limit to 2,000 characters. A repeat changes nothing.

| Check | Expect |
|---|---|
| `select has_function_privilege('authenticated', 'public.check_out(uuid, text)', 'execute') and not has_function_privilege('anon', 'public.check_out(uuid, text)', 'execute');` | `true` |

Reverse step: in the file, **only while no visit note longer than 1,000 characters exists**.

### 0017 `test_clock_per_caregiver` (DEV-070, draft; tests only)

The test clock (zero rows in production) now belongs to one Caregiver, so a test that sets it does not change "now" for anyone else. Nothing in the app reads or writes it; **it exists in production only because the migrations are applied as a set**, and its only job there is to have zero rows.

| Check | Expect |
|---|---|
| `select count(*) from information_schema.columns where table_schema = 'private' and table_name = 'test_clock' and column_name in ('caregiver_id', 'now_override');` | `2` (0020 renamed the moment column from `at` to the spec's `now_override`) |
| `select not has_table_privilege('authenticated', 'private.test_clock', 'select') and not has_table_privilege('anon', 'private.test_clock', 'select') and not has_function_privilege('authenticated', 'private.visit_now()', 'execute');` | `true` |

Reverse step: in the file (puts back the single-row clock of 0011).

### 0018 `family_visit_views` (DEV-073, draft)

`public.family_visit` and `public.family_visit_tasks`: what a family reads of a visit. Both are composed on `public.family_bookings` (which keeps only the signed-in family's own bookings). `family_visit` gives the check-in time for a booking in progress or completed, and the check-out time and the note about the visit only when the booking is completed **and** the visit is closed. `family_visit_tasks` gives rows only under that same completed-and-closed condition: one per task, with the outcome (`done`, `not_done`, or `not_recorded` for an Optional task never logged), the reason only for Not done, the note only for Done, and no Required flag, no ids, no earlier entry. If a closed visit has a Required task with no outcome (a hand edit), it gives no task rows at all rather than a Required task shown as Not recorded. **Both views run with their owner's rights**, and the family composition plus the completed-and-closed condition are the only barrier: the Tech Lead should read them, with `family_bookings`, `caregiver_visit` and `caregiver_visit_tasks`. The column list is a draft: FD-FAMVIS §7.2 was not available.

| Check | Expect |
|---|---|
| `select count(*) from pg_views where schemaname = 'public' and viewname in ('family_visit', 'family_visit_tasks');` | `2` |
| `select has_table_privilege('authenticated', 'public.family_visit', 'select') and has_table_privilege('authenticated', 'public.family_visit_tasks', 'select') and not has_table_privilege('anon', 'public.family_visit', 'select') and not has_table_privilege('anon', 'public.family_visit_tasks', 'select');` | `true` |

Reverse step: in the file (drops the two views).

### 0019 `ddo_optional_task` (DEV-074; confirmed by FD-VISIT §5.7(c) and §7.2 on 2026-11-06, VIZ-92)

Swaps which Doctor's Day Out task is Optional: Pre-visit preparation becomes Optional and Advocacy and note-taking Required (0011 guessed the other way; a completed visit with Pre-visit preparation never logged, as DEV-074 describes, is only possible if it is the Optional one). Only the checklist changes: a visit already started keeps the flags it was given.

| Check | Expect |
|---|---|
| `select string_agg(name, ', ') from public.checklist_items where bundle_code = 'doctors_day_out' and not is_required;` | `Pre-visit preparation` |
| `select count(*) from public.checklist_items where bundle_code = 'doctors_day_out' and is_required;` | `3` |

Reverse step: in the file (swaps the two flags back).

### 0020 `align_visit_model_with_fd_visit` (VIZ-91)

Rebuilds the visit objects in the shape of FD-VISIT §7.2 to §7.4 and FD-FAMVIS §7.2: `checklist_items` keyed by (`bundle_code`, `task_key`) with `is_required` and `note_required_for_done`; `visit_tasks` and `visit_task_entries` with the spec's columns (entries carry `logged_by`); the three functions with the spec's arguments and error codes (an unverified Caregiver gets the same answer as for no booking); `caregiver_visit`, `caregiver_visit_tasks`, `private.visit_task_latest` and the two family views with the spec's columns; and the Admin's SELECT on the three visit tables. **It refuses to run if any visit exists**, because the tables are append-only and rebuilding them would lose records. The test clock keeps its rows.

| Check | Expect |
|---|---|
| `select string_agg(task_key, ',' order by bundle_code, sort_order) from public.checklist_items;` | `pre_visit_preparation,transport_and_escort,advocacy_and_note_taking,post_visit_summary,medication_assistance,vitals_check,companionship` |
| `select string_agg(name, ', ' order by sort_order) from public.checklist_items where bundle_code = 'doctors_day_out';` | `Pre-visit preparation, Transport and escort, Advocacy and note-taking, Post-visit summary` |
| `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('check_in', 'log_visit_task', 'check_out');` | `3` (one of each; the old four-argument `log_visit_task` is gone) |
| `select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'caregiver_visit_tasks';` | `booking_id,task_key,name,sort_order,is_required,note_required_for_done,outcome,note,reason,logged_at` |

Reverse step: in the file. **It drops the visit tables and so loses every visit written.** Run it only on a project with no real visits.

### 0021 `admin_exceptions` (DEV-079; FD-ADMINEXC §9)

Creates `private.exception_settings` (three rows, no API privilege: `on_time_minutes` 30, `in_progress_hours` 8, `window_days` 7) and the view `public.admin_exceptions`: the Admin's read-only list of bookings that need a look, derived on every read from the visit records (nothing is stored). It is composed on `admin_booking_overview`, so only an Admin gets rows; it runs with its owner's rights and `security_barrier`; the Tech Lead reads the composition with `family_bookings` and the other owner-rights views. It returns sixteen columns and never a note, the visit note, care notes, a phone number or an id of a visit, task, entry or caregiver.

| Check | Expect |
|---|---|
| `select key, value from private.exception_settings order by key;` | `in_progress_hours 8`, `on_time_minutes 30`, `window_days 7` |
| `select not has_table_privilege('authenticated', 'private.exception_settings', 'select') and not has_table_privilege('anon', 'private.exception_settings', 'select');` | `true` |
| `select has_table_privilege('authenticated', 'public.admin_exceptions', 'select') and not has_table_privilege('anon', 'public.admin_exceptions', 'select') and not has_table_privilege('authenticated', 'public.admin_exceptions', 'insert');` | `true` |
| `select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'admin_exceptions';` | `16` |

Reverse step: in the file (drops the view and the settings table; nothing else is lost, because nothing is stored).

### The whole database, after all twenty-one

| Check | Expect |
|---|---|
| `select count(*) from pg_tables where schemaname = 'public' and not rowsecurity;` | `0` (every table has row-level security on; the four visit tables included) |

### Reverse steps: the order

Run by hand, in this order, never more than you need: **0021, 0020, 0019, 0018, 0017, 0016, 0015, 0014, 0013, 0012, 0011.** After any reverse step, re-run the checks of the migrations that remain applied.

- **A reverse step loses data.** Dropping the visit tables (0011) deletes every visit; visits and their entries can never be deleted by the app. Prefer a new forward migration that fixes the problem.
- **Do not reverse a migration to fix an app problem.** Fix forward (see "After the release" in the main runbook).
- None of the FD-VISIT reverse steps re-opens a data hole the way 0006's does, but 0011's drops the guards along with the tables: run it only on a project with no real visits.

---

# Part 2. The production checks

Run these **after the migrations and before the first Caregiver is told to check in**, and again after every release that touches the visit tables. **All four must hold.**

**1. The test clock has zero rows.** A row would change what "now" means for one Caregiver's visits.

```sql
select count(*) from private.test_clock;
```
Expect `0`. If it is not zero, find out who wrote it, then delete the rows by hand: `delete from private.test_clock;`. (The clock is the one place a time is not the real time; nothing in the app writes it.)

**2. The 7 checklist rows are present.**

```sql
select bundle_code, count(*) from public.checklist_items group by bundle_code order by bundle_code;
```
Expect `doctors_day_out 4` and `medicheck 3` (7 in all). The names, keys and Required / Optional flags are those of FD-VISIT §7.2 (checked 2026-11-06); read them once: `select bundle_code, sort_order, task_key, name, is_required, note_required_for_done from public.checklist_items order by bundle_code, sort_order;`.

**3. The probe returns nothing.** (Check 4, the exception settings, follows the probe.) The probe of §7.3 item 13 lists every row that breaks a rule the visit functions and triggers keep. **The first three kinds below, and a visit with no tasks (covered by `SNAPSHOT_MISMATCH`), are the rules of §7.3 item 13 and TC-VIS-044; the others are further integrity checks the functions and triggers keep, added on purpose and recorded in the Draft Decisions register (F1).** The same rules are in `scripts/seed/probe.mjs`, which the tests and the seed run.

```sql
with
  b as (select id, status::text as status, bundle_code, assigned_caregiver_id from public.bookings),
  v as (select id, booking_id, caregiver_id, checked_in_at, checked_out_at from public.visits),
  t as (select id, visit_id, task_key, is_required, note_required_for_done from public.visit_tasks),
  e as (select id, visit_task_id, outcome::text as outcome, note, reason, logged_at from public.visit_task_entries)
select 'BOOKING_WITHOUT_VISIT' as kind, b.id::text as ref
  from b where b.status in ('in_progress', 'completed') and not exists (select 1 from v where v.booking_id = b.id)
union all
select 'STATUS_MISMATCH', v.id::text
  from v join b on b.id = v.booking_id
 where b.status <> case when v.checked_out_at is null then 'in_progress' else 'completed' end
union all
select 'WRONG_CAREGIVER', v.id::text
  from v join b on b.id = v.booking_id where b.assigned_caregiver_id is distinct from v.caregiver_id
union all
select 'CLOSED_BEFORE_OPEN', v.id::text from v where v.checked_out_at < v.checked_in_at
union all
select 'TWO_OPEN_VISITS', v.caregiver_id::text from v where v.checked_out_at is null group by v.caregiver_id having count(*) > 1
union all
select 'SNAPSHOT_MISMATCH', v.id::text
  from v join b on b.id = v.booking_id
 where (select coalesce(array_agg(t.task_key order by t.task_key), '{}') from t where t.visit_id = v.id)
       is distinct from
       (select coalesce(array_agg(c.task_key order by c.task_key), '{}') from public.checklist_items c where c.bundle_code = b.bundle_code)
union all
select 'REQUIRED_TASK_NOT_LOGGED', t.id::text
  from t join v on v.id = t.visit_id
 where v.checked_out_at is not null and t.is_required and not exists (select 1 from e where e.visit_task_id = t.id)
union all
select 'ENTRY_OUTSIDE_VISIT', e.id::text
  from e join t on t.id = e.visit_task_id join v on v.id = t.visit_id
 where e.logged_at < v.checked_in_at or (v.checked_out_at is not null and e.logged_at > v.checked_out_at)
union all
select 'ENTRY_WITHOUT_TEXT', e.id::text
  from e join t on t.id = e.visit_task_id
 where (e.outcome = 'not_done' and e.reason is null) or (e.outcome = 'done' and t.note_required_for_done and e.note is null);
```

Expect **no rows**. What each kind means, and what to do (use part 3 for the fix):

| Kind | Meaning |
|---|---|
| `BOOKING_WITHOUT_VISIT` | a booking is in progress or completed but has no visit (ref: the booking) |
| `STATUS_MISMATCH` | an open visit whose booking is not in progress, or a closed one whose booking is not completed (ref: the visit) |
| `WRONG_CAREGIVER` | the visit's Caregiver is not the booking's assigned Caregiver (ref: the visit) |
| `CLOSED_BEFORE_OPEN` | checked out before it was checked in (ref: the visit) |
| `TWO_OPEN_VISITS` | one Caregiver has more than one open visit (ref: the Caregiver) |
| `SNAPSHOT_MISMATCH` | the visit's tasks are not one per checklist item of its bundle, by `task_key` (ref: the visit); this includes a visit with no tasks |
| `REQUIRED_TASK_NOT_LOGGED` | a closed visit with a Required task that has no entry (ref: the task) |
| `ENTRY_OUTSIDE_VISIT` | an entry logged before check-in or after check-out (ref: the entry) |
| `ENTRY_WITHOUT_TEXT` | a Done entry without the note its task needs, or a Not done entry without a reason (ref: the entry) |

**4. The three exception settings are present** (FD-ADMINEXC §9, DEV-071). The Exceptions list reads its three figures from here; with a row missing, the list shows nothing for that rule.

```sql
select key, value from private.exception_settings order by key;
```
Expect exactly three rows: `in_progress_hours 8`, `on_time_minutes 30`, `window_days 7` (or the figures the founder has since decided). CI checks the same query on a fresh database (`0019_admin_exceptions.test.sql`).

---

# Part 3. Correcting a wrong or stuck visit by hand (Option A, §5.7(i))

**TO CONFIRM with the Tech Lead.** This is David's proposal. FD-VISIT §5.7(i) and §7.8(g) say only that the Tech Lead corrects a wrong or stuck visit by hand, by disabling a trigger inside one transaction or by a documented correction function, and that DEV-071 writes the procedure for the Tech Lead to confirm: he says whether this is the procedure, and whether recording the change the way it is recorded below is enough (see "How the change is recorded"). **New since 0020:** every entry now carries `logged_by` (a profile). The statements below use the visit's Caregiver as `logged_by`, because the entry is added on the visit's behalf; the text of the entry names the Tech Lead and says why. If the Tech Lead would rather the entry carry their own profile, that is a one-word change.

**When:** a Caregiver cannot finish a visit (a Required task cannot be logged, the app will not let them check out), or a closed visit holds something wrong. The app has no screen for this on purpose. **The Tech Lead is the only person who does it, in the SQL editor, as the project owner, and writes down each one.**

**What stops a change, and what the procedure does about it.** The tables keep three rules for themselves, and they bind every role, the owner included (`backend-config/.../0011_visit_schema.sql`):

| Rule | Trigger | Function |
|---|---|---|
| A closed visit cannot change; a visit's booking, Caregiver and check-in time never change; a visit is never deleted | `visits_guard` | `private.guard_visit_update()` |
| An entry is never updated or deleted; snapshot rows are never updated or deleted | `visit_task_entries_append_only`, `visit_tasks_append_only` | `private.reject_modification()` |
| No entry can be added to a closed visit | `visit_task_entries_open_visit_only` | `private.guard_entry_insert()` |

**The principle: change as little as possible, and never edit history.** Where the visit is still open, nothing is switched off. Where it is closed, one guard is switched off for one statement, inside one transaction, and switched back on in the same transaction; a wrong entry is corrected by **adding** a new one, which then counts (the highest id counts), and the earlier one stays. No trigger is ever dropped. Never `delete` anything.

Before any of these, **look**, and write down what you see:

```sql
select v.id as visit_id, v.booking_id, v.caregiver_id, v.checked_in_at, v.checked_out_at, v.visit_note, b.status
  from public.visits v join public.bookings b on b.id = v.booking_id
 where v.booking_id = '<booking id>';

select t.id as task_id, t.name, t.is_required, e.id as entry_id, e.outcome, e.note, e.reason, e.logged_at
  from public.visit_tasks t left join public.visit_task_entries e on e.visit_task_id = t.id
 where t.visit_id = '<visit id>' order by t.sort_order, e.id;
```

### Case 1: a stuck open visit (it must be closed, and a Required task cannot be logged)

Nothing is switched off: the visit is open, so entries may be added and the visit may be closed. Every Required task with no outcome gets a **Not done** entry whose reason says who closed it and why, then the visit is closed with a note saying the same, then the booking is moved on.

```sql
begin;

insert into public.visit_task_entries (visit_task_id, outcome, reason, logged_by, logged_at)
select t.id, 'not_done', 'Closed by <name> (Tech Lead) on <date>: <why> (<ticket>)',
       (select caregiver_id from public.visits where id = '<visit id>'), clock_timestamp()
  from public.visit_tasks t
 where t.visit_id = '<visit id>' and t.is_required
   and not exists (select 1 from public.visit_task_entries e where e.visit_task_id = t.id);

update public.visits
   set checked_out_at = clock_timestamp(),
       visit_note = 'Closed by <name> (Tech Lead) on <date>: <why> (<ticket>)'
 where id = '<visit id>' and checked_out_at is null;

update public.bookings set status = 'completed'
 where id = '<booking id>' and status in ('assigned', 'in_progress');

-- run the probe (part 2, check 3): nothing may be listed for this booking or visit
commit;   -- or rollback; if it lists anything
```

Keep each text under 500 characters (the reason) and 2,000 (the visit note). **The reason and the note are shown to the family** on the visit, as the Caregiver's record is: write them so the family can read them.

### Case 2: a closed visit has the wrong visit note, or the wrong check-out time

The guard on `visits` is switched off for one statement and back on. Appending the correction to the existing note (rather than replacing it) keeps what was there.

```sql
begin;

alter table public.visits disable trigger visits_guard;

update public.visits
   set visit_note = coalesce(visit_note || E'\n', '') || 'Corrected by <name> (Tech Lead) on <date>: <what and why> (<ticket>)'
 where id = '<visit id>';

alter table public.visits enable trigger visits_guard;

select tgenabled from pg_trigger where tgname = 'visits_guard' and tgrelid = 'public.visits'::regclass;   -- must be 'O'
commit;   -- ROLLBACK, not commit, if it is not 'O'
```

The note stays under 2,000 characters in all. The booking, the Caregiver and the check-in time cannot be changed even with the guard off (they are the visit's identity): if one is wrong, the visit is a mistake to be explained in a note, not to be rewritten.

### Case 3: a wrong entry on a closed visit

An entry is never edited. The guard that refuses entries on a closed visit is switched off for one statement, and a **new** entry is added with the right outcome and a note that says who corrected it and why. It counts from then on; the earlier entry stays in the visit record. Its time is set to the visit's check-out time, so it stays inside the visit (the probe flags an entry outside it).

```sql
begin;

alter table public.visit_task_entries disable trigger visit_task_entries_open_visit_only;

insert into public.visit_task_entries (visit_task_id, outcome, note, logged_by, logged_at)
select t.id, 'done', 'Corrected by <name> (Tech Lead) on <date>: <what and why> (<ticket>)', v.caregiver_id, v.checked_out_at
  from public.visit_tasks t join public.visits v on v.id = t.visit_id
 where t.id = '<task id>' and v.checked_out_at is not null;
-- for a Not done correction: outcome 'not_done' and the text as the reason column instead of note

alter table public.visit_task_entries enable trigger visit_task_entries_open_visit_only;

select tgenabled from pg_trigger where tgname = 'visit_task_entries_open_visit_only' and tgrelid = 'public.visit_task_entries'::regclass;   -- must be 'O'
commit;   -- ROLLBACK, not commit, if it is not 'O'
```

### Case 4: a booking marked in progress with no visit (the probe's `BOOKING_WITHOUT_VISIT`)

No visit exists to correct, so the booking is put back to what it was; the Caregiver can then check in properly.

```sql
update public.bookings set status = 'assigned' where id = '<booking id>' and status = 'in_progress';
```

### How the change is recorded (who and why) — TO CONFIRM

1. **In the data:** every text the Tech Lead adds names **who** (their name and role), **when** and **why**, with the ticket or message that asked for it (cases 1 to 3 above). There is no way to change the data without leaving that text, because history is only ever added to.
2. **In a release log kept outside the database** (the Tech Lead's own): the visit id, the case, the statements run, what was looked at before, the probe result after, and the time.
3. **Proposed, not built:** an append-only table `private.visit_corrections` (who, when, visit id, case, why) written in the same transaction, so the record cannot be forgotten. **That is a migration and so is the Tech Lead's decision, not part of this addendum.** Until it exists, 1 and 2 are the record.

After any correction: run the probe (part 2, check 3). It must return nothing for the visit.

---

# Part 4. No test rows in production

Production starts empty and holds only real people (Test_Data_Strategy.md §6). Test accounts use only two address domains: `@test.vizazicare.example` (the seed, the factories and the UAT accounts) and `@vizazi-qa.test` (the booking tests). Run this **before the first release and after every release**, and also before real families sign up:

```sql
select 'profile' as kind, p.email as ref from public.profiles p
 where p.email ilike '%@test.vizazicare.example' or p.email ilike '%@vizazi-qa.test'
union all
select 'care_recipient', r.name from public.care_recipients r join public.profiles p on p.id = r.account_id
 where p.email ilike '%@test.vizazicare.example' or p.email ilike '%@vizazi-qa.test'
union all
select 'booking', b.id::text from public.bookings b join public.profiles p on p.id = b.account_id
 where p.email ilike '%@test.vizazicare.example' or p.email ilike '%@vizazi-qa.test'
union all
select 'visit', v.id::text from public.visits v join public.bookings b on b.id = v.booking_id join public.profiles p on p.id = b.account_id
 where p.email ilike '%@test.vizazicare.example' or p.email ilike '%@vizazi-qa.test'
union all
select 'test_clock', c.caregiver_id::text from private.test_clock c;
```

Expect **no rows**. If anything is listed, **do not delete it**: visits, entries and history can never be deleted, and an account with history cannot be (see the provisioning runbook: ban it instead). Production must not contain the data at all, so the cause is that something wrote it there: find out how (a seed or a test run pointed at production), stop that, and tell the Tech Lead before anything is changed.

**Why this should not happen:** the seed refuses any database that is not the local stack or the dev project (`scripts/seed/allow-list.mjs`; production is never on it), the test clock refuses any host but localhost, and the tests run only against the local stack in CI.

**An account whose address is not a test address is not caught by this query.** A person's real address is never a test address; if a test account was ever created with a real-looking address, the elevated-account query of the main runbook (Part B, step 4) and a read of the profiles table by hand are the only checks.

---

# Part 5. Changing an exception setting (FD-ADMINEXC §9, decision 15)

**The rule:** each of the three rows of `private.exception_settings` (migration 0021) is changed by **one `UPDATE`**, by the Tech Lead, as the project owner, in the SQL editor. No screen changes them and nobody else does. A change takes effect on the next read of the Exceptions list: no migration, no deployment. The keys and what they mean:

| `key` | Meaning | Now |
|---|---|---|
| `on_time_minutes` | The on-time threshold: a booking with no check-in shows after this many minutes past its requested time (E1), and a check-in later than this is late (E2). Exactly on the figure is not shown | 30 (the founder, 2026-08-28) |
| `in_progress_hours` | DEC-3: an open visit shows as "Still in progress" (E3) once checked in more than this many hours ago. Exactly on the figure is not shown | 8 |
| `window_days` | DEC-4: the list covers visit days from this many days ago to today, in Nairobi time | 7 |

A value must be a whole number above zero (a constraint refuses anything else), and no other key can be added. Run it on the right project (check the target first, as in the main runbook):

```sql
select key, value from private.exception_settings order by key;      -- look, and write both down
update private.exception_settings set value = <new value> where key = '<the key>';
select key, value from private.exception_settings order by key;      -- read it back
```

Look at the rows before and after, and write both down (the release log of part 3). To undo it, run the same `UPDATE` with the old value.

**When the DEC-4 row (`window_days`) changes, two lines of text change with it, in the same release.** The screen writes the figure as text, and the view returns no window value, so the figure is not read from the setting. The two lines are in `lib/admin/exceptions-text.ts`:

- `Last 7 days. This list sends no alerts.` (`EXCEPTIONS_TEXT.intro`)
- `No exceptions from the last 7 days` (`EXCEPTIONS_TEXT.emptyHeading`)

Change both to the new number of days **in the same release as the UPDATE**, and look at the screen afterwards: a screen that says "Last 7 days" over a 14-day window is wrong in a way no test sees. (The tests prove that the three boundaries follow the settings with no change to any code, `admin-exceptions-settings.spec.ts`; they do not read the copy against the setting, by decision 15.)

---

# Open points

- **The visit schema has been checked against FD-VISIT section 7 (VIZ-91, 2026-11-06)** and migration 0020 corrects it. The visit migrations 0011 to 0021 are not on production and are released as one set (0011 to 0020 are on dev; 0021, the Exceptions view, is in the repository and waits for the founder's word).
- **The Tech Lead's confirmation of part 3** (the cases, the two guards switched off for one statement each, the recording) and the decision on the `private.visit_corrections` table.
- **The probe's rules** (part 2, check 3) include the four of §7.3 item 13 and further checks of our own; whether to keep the extras is the Tech Lead's to say (they cannot fire on a database the functions have kept).
- **Part 5** is written now that migration 0021 exists; the Tech Lead's review of the view, `security_barrier`, the settings table and the composition on `admin_booking_overview` is still to come (FD-ADMINEXC §9). The 8-hour figure rests on the Doctor's Day Out length, TO CONFIRM by the founder.
- **Rehearse** with the main runbook's part C: this addendum's checks, and the reverse step of 0016 followed by the check of 0015, once, so a reverse has been seen to work.
