# FD-VISIT and FD-FAMVIS: every draft decision, to check against the documents

**Why this exists.** The visit database (migrations 0011 to 0019), the Caregiver's visit screens (DEV-064 to DEV-067), the family's visit block and report (DEV-075 to DEV-078) and the test data (DEV-070, DEV-074) were all built while FD-VISIT, FD-FAMVIS and Test_Data_Strategy.md were **not available**, from the task texts alone. Every choice the task text did not fix is a guess. This is the one list of them, so each can be confirmed or corrected against the documents in a single pass.
**For:** Linear VIZ-91 (the schema, functions, views, wording and layout) and VIZ-92 (the Doctor's Day Out Optional task).
**Status:** written 2026-11-05 from the task texts alone. **Checked against FD-VISIT (V6) and FD-FAMVIS on 2026-11-06 (VIZ-91, VIZ-92): the outcome of every row is in the table at the end of this file, "Outcome of the check".** The tables below are kept as they were written, so the guess and the answer can be compared. Test_Data_Strategy.md arrived the same day and was checked afterwards (VIZ-90, VIZ-93): see row F2.

**How a correction is made.** Applied migrations are never edited: a correction is a new migration (0020 onward) with its own reverse step, applied to dev only when the founder or Tech Lead says so. Wording and layout corrections are an edit in the file named. The tests that encode a choice are named so they are changed in the same commit. **Do it before real visits exist**: the visit tables are append-only, so a correction is easy while dev holds no visits (it held none on 2026-11-05) and harder afterwards.

**The documents needed** (none was supplied): FD-VISIT §5.7, §6 (§6.5 wording), §7.2 to §7.4, §12.2; FD-FAMVIS §6.1, §6.4, §6.5, §6.6, §7.2, §7.3, §15; FD-ADMINEXC §9; Test_Data_Strategy.md §3 to §7 (the version with the visit rows); FD-ACC §6.7.

**Status of the database on dev (`fzkwbajawfircwfzwbjg`), 2026-11-05:** 0001 to 0019 applied, none to production, 0 visits.

---

## A. The schema (migration 0011, with 0015, 0016, 0017, 0019)

| # | What was guessed | Where | Check against | Tests that encode it |
|---|---|---|---|---|
| A1 | The 7 `checklist_items` rows: MediCheck = Medication assistance, Vitals check, Companionship; Doctor's Day Out = Pre-visit preparation, Transport & escort, Advocacy and note-taking, Post-visit summary; their order (`sort_order`) and the column names | 0011, 0015 (renamed "Post-visit report" to "Post-visit summary") | §7.2 | `0012_visits.test.sql`, `0013_visit_tasks.test.sql`, `0014_log_visit_task.test.sql`, `0017_visit_release_checks.test.sql`, `check-in.spec.ts` |
| A2 | **Which task of each bundle is Optional.** MediCheck: Companionship (from DEV-065). Doctor's Day Out: **Pre-visit preparation** (0019 swapped it from the first guess, Advocacy and note-taking, because DEV-074 describes a completed visit with Pre-visit preparation never logged) | 0011, **0019** | §7.2 / DEV-065. **VIZ-92.** If it is another task: a new migration swaps the flags again, and these tests and strings change | `check-out.spec.ts`, `visit-in-progress.spec.ts`, `0017_visit_release_checks.test.sql` (0019 check), `family-visibility-data.ts` |
| A3 | Which tasks need a note (`note_required`): Vitals check, Advocacy and note-taking, Post-visit summary | 0011 | §7.2, §6.5 | `0012_visits.test.sql` ("three tasks need a note"), `log-task.spec.ts` |
| A4 | `visits`: `booking_id` unique ("each booking is one visit"); one open visit per Caregiver (partial unique index); `visit_note` | 0011 | §7.2 | `0012_visits.test.sql` |
| A5 | **Text limits: task note 2,000, reason 500, visit note 2,000.** (0011 guessed 1,000 for all; 0015 and 0016 raised them to the numbers in DEV-066 and DEV-067's texts, which are themselves the only source) | 0011, 0015, 0016 | §7.2, §6.5 | `log-task.spec.ts`, `check-out.spec.ts`, `family-visibility-data.ts` (the longest texts) |
| A6 | `visit_tasks` is a snapshot of the checklist at check-in (name, Required, note needed, order); a later change to the checklist never changes a visit already started | 0011 | §7.2 | `0013_visit_tasks.test.sql`, `0018_entry_that_counts.test.sql` |
| A7 | `visit_task_entries`: `bigint` identity id; the entry that counts is the highest id; a Not done entry must have a reason | 0011 | §7.2 | `0018_entry_that_counts.test.sql` |
| A8 | The rules the tables keep for themselves and their error texts: a closed visit never changes (`VISIT_CLOSED`); entries and snapshot rows are never updated or deleted; no entry added to a closed visit; a visit is never deleted | 0011 | §7.2 | `0012_visits.test.sql`, `0017_visit_release_checks.test.sql` (hand-correction cases) |
| A9 | The test clock: `private.test_clock` with one row **per Caregiver** (0017), read by `private.visit_now()`; zero rows in production | 0011, 0017 | §7.2, §12 (TC-VIS-045) | `0016_test_clock.test.sql`, `visit-factories.spec.ts` |
| A10 | The Nairobi day rule: a visit can be checked in only on the booked day in Africa/Nairobi | 0012 | §7.3 | `0012_visits.test.sql`, `check-in.spec.ts` |

## B. The functions (migrations 0012, 0015, 0016)

| # | What was guessed | Where | Check against | Tests |
|---|---|---|---|---|
| B1 | `check_in(booking)`: errors `NOT_CAREGIVER`, `CAREGIVER_NOT_VERIFIED`, `BOOKING_NOT_FOUND`, `BOOKING_NOT_ASSIGNED`, `NOT_VISIT_DAY`, `ANOTHER_VISIT_IN_PROGRESS`, **tested in that order**; a repeat call returns the same visit; returns `jsonb` with `visit_id` and `checked_in_at`; lock order booking then visit | 0012 | §7.3 | `0012_visits.test.sql`, `visit-action-errors.spec.ts` |
| B2 | `log_visit_task(task, outcome, note, reason)`: errors `NOT_CAREGIVER`, `CAREGIVER_NOT_VERIFIED`, `TASK_NOT_FOUND`, `VISIT_CLOSED`, `INVALID_OUTCOME`, `NOTE_REQUIRED`, `REASON_REQUIRED`, `NOTE_TOO_LONG`, `REASON_TOO_LONG` in that order; text is trimmed and empty means none; an identical repeat adds nothing (`changed: false`) | 0015 | §7.3 items 5, 6, 8, 9 | `0014_log_visit_task.test.sql`, `visit-action-errors.spec.ts` |
| B3 | `check_out(booking, note)`: errors `NOT_CAREGIVER`, `CAREGIVER_NOT_VERIFIED`, `BOOKING_NOT_FOUND`, `VISIT_NOT_FOUND`, `VISIT_NOTE_TOO_LONG`, `REQUIRED_TASKS_MISSING`; closes the visit and moves the booking to completed; a repeat changes nothing | 0016 | §7.3 | `0015_check_out.test.sql`, `visit-action-errors.spec.ts` |
| B4 | The mapping of every code to what the screen does and says (reload with no text, "already checked out", keep what was typed, retry), the pending texts, and that an unnamed code shows the generic text | `lib/visits/action-errors.ts` (DEV-069) | the table in §7.3 | `visit-action-errors.spec.ts` |

## C. The views (migrations 0013, 0014, 0018)

| # | What was guessed | Where | Check against | Tests |
|---|---|---|---|---|
| C1 | `caregiver_visit`: the columns, the `day_state` rule (before, today, passed), the Verified filter. **Runs with its owner's rights; the filter on `auth.uid()` is the only barrier: the Tech Lead reads it** | 0013 | §7.2, §7.4 | `0012_visits.test.sql`, `check-in.spec.ts` |
| C2 | `caregiver_visit_tasks`: the columns, the Verified filter. Owner's rights: **Tech Lead reads it** | 0014 | §7.2, §7.4 | `0013_visit_tasks.test.sql`, `0018_entry_that_counts.test.sql` |
| C3 | `private.visit_task_latest` (DEV-072): the five columns plus an extra `entry_id` | 0014 | §7.2 (drop `entry_id` with a migration if exactly five are wanted) | `0018_entry_that_counts.test.sql` |
| C4 | `private.visit_day_state` is granted to `authenticated` because PostgreSQL checks a function a view calls as the caller. **Is that acceptable?** `private.visit_now()` stays closed | 0013 | Tech Lead | `0017_visit_release_checks.test.sql` |
| C5 | `family_visit`: `booking_id, checked_in_at, checked_out_at, visit_note`; the check-out time and note only when the booking is completed **and** the visit closed | 0018 | FD-FAMVIS §7.2 | `family-visit-views.spec.ts` |
| C6 | `family_visit_tasks`: `booking_id, sort_order, name, outcome, logged_at, reason, note`; rows only when completed and closed; `reason` only for Not done, `note` only for Done; **`booking_id` and `note` are columns** (the reading of "no ids"); **a closed visit with a Required task not logged gives no task rows at all** (so a Required task is never Not recorded) | 0018 | FD-FAMVIS §7.2 | `family-visit-views.spec.ts` |
| C7 | `security_barrier = true` on the family views, as on `family_bookings` | 0018 | Tech Lead (§7.8(b)) | `0017_visit_release_checks.test.sql` |
| C8 | Admin SELECT on the four visit tables (DEV-062) is **not built** | — | §7.4 | none |

## D. Wording

| # | What was guessed | Where | Check against |
|---|---|---|---|
| D1 | The Medication assistance description and the "if unsure" sentence; the Check-in dialog's detail and body lines | `lib/visits/assignment-text.ts` | §6.5 verbatim |
| D2 | The prompts on Log a task: one **Reason** prompt for every task ("Say why this task was not done."), the plain Note prompt, the labels "Readings", "Notes", "Summary"; "already checked out" | `lib/visits/log-task-text.ts` | §6.5 (the Reason prompt differs by task there) |
| D3 | The error and pending texts of the three actions | `lib/visits/action-errors.ts` | §7.3 table |
| D4 | The check-out dialog (too long, not checked out), the summary's labels ("Note:", the heading "Note about the visit"), and that the summary replaces the whole assignment page | `lib/visits/check-out-text.ts` | §6.5 |
| D5 | The family's visit block and report words: the lines given in the tickets are exact; the layout, the order of the cards and the neutral chip fill are drafted | `lib/visits/family-visit-text.ts`, `components/booking/visit-report.tsx`, `components/ui/status-chip.tsx` | FD-FAMVIS §6.1, §6.4, §6.5, frames FAM-02 to FAM-07 |
| D6 | The count line: wording exactly as the ticket; its place (directly under the recorded-by line) and styling (body text) | `lib/visits/count-line.ts`, `visit-report.tsx` | §5.7(c), §6.5 |

## E. Layout and behaviour

| # | What was guessed | Where | Check against |
|---|---|---|---|
| E1 | Care notes sit **below** the checklist so the notice is directly under the booking summary | `app/assignments/[id]/page.tsx` (DEV-064) | frames VIS-02 to VIS-05b |
| E2 | While in progress, the Tasks card **replaces** the "Visit checklist" block, so the Medication assistance lines are not shown then | DEV-065 | VIS-06 frames |
| E3 | A booking in progress with **no visit row** (only test data can make one): on the Caregiver's page an empty Tasks card and no Check out; on the family's page **no visit block** | `app/assignments/[id]/page.tsx`, `lib/visits/family-visit.ts` | §7.3 state table |
| E4 | The family's states F1 to F6 and what chooses them (`familyVisitState`) | `lib/visits/family-visit.ts` | §7.3 state table (not supplied) |
| E5 | "Try again" on the family's visit block also re-reads the booking's status | `app/bookings/[id]/actions.ts` | §7.3 |
| E6 | Max width of the Booking Detail column: the shell is 672px (`max-w-2xl`), so 640px (§6.6(j)) was not added | `app/bookings/[id]/page.tsx` | §6.6(j), §7.8(e) |
| E7 | The order of My Bookings and the two chips | `lib/bookings/order.ts`, `status-label.ts` | FD-FAMVIS §7.3, §6.6(c), frames FAM-01, FAM-02 |

## F. Test data and tooling

| # | What was guessed | Where | Check against |
|---|---|---|---|
| F1 | The probe's rules (booking without visit, status mismatch, wrong caregiver, snapshot not the checklist, Required task not logged on a closed visit, entry outside the visit, entry without its text, two open visits, closed before opened) | `scripts/seed/probe.mjs`, the SQL in `docs/FD-VISIT Runbook Addendum.md` part 2 | §7.3 item 13 |
| F2 | B6 and B7 content and times, the task keys (the checklist names), "Recipient 4A" = Seed Recipient 4, B3 to B5 dated 3 Nairobi days out (B4 at 11:00) | `scripts/seed/starter-set.mjs`, `tests/e2e/factories.ts` | Test_Data_Strategy.md §3, §5, §7 (and update its §7 and §3.3) |
| F3 | The hand-correction procedure (four cases, guards switched off for one statement) and how it is recorded; whether to build `private.visit_corrections` | `docs/FD-VISIT Runbook Addendum.md` part 3 | Tech Lead; §5.7(i) |
| F4 | Changing an exception setting (waiting for `private.exception_settings`) | addendum part 5 | FD-ADMINEXC §9 |

---

## How each is closed

For each row, one of: **confirmed** (write the date and the section in the Linear ticket), or **corrected** (a new migration or an edit, the tests in the last column changed in the same commit, green in CI, applied to dev on the founder's word, recorded in the ticket). VIZ-91 is done when every row of A to E is one or the other; VIZ-92 is rows A2.


---

## Outcome of the check (2026-11-06)

Checked against `FD-VISIT_V6.md` (§5.7, §6.5, §6.6, §7.2 to §7.4, §7.8, §12.1) and `FD-FAMVIS_Family_Visibility.md` (§6.1, §6.5, §6.6, §7.2 to §7.4). **Corrected** rows are one new migration, **0020**, plus edits to the files named; the tests that encode each were changed in the same commit. **Confirmed** rows needed no change. **Kept** rows differ from the document, or the document is silent, and are kept on purpose: the reason is given and the Tech Lead can reverse any of them.

| # | Result | What the document says, and what was done |
|---|---|---|
| A1 | **Corrected** | §7.2 gives the table: key (`bundle_code`, `task_key`), columns `is_required` and `note_required_for_done`, the seven rows with their keys. Only the task name "Transport & escort" was wrong (it is "Transport and escort"); the others and the order were right. 0020 rebuilds the table; the seed, the tests and the screens use the keys. The Doctor's Day Out card on Bundle Selection keeps FD-ACC's own words ("Transport & escort", "Post-visit report"): they are that card's, not the checklist's. |
| A2 | **Confirmed (VIZ-92)** | §5.7(c): "Pre-visit preparation is Optional" and the other three Doctor's Day Out tasks Required; the §7.2 seed table says the same. Migration 0019 was right. No change. |
| A3 | **Confirmed** | §7.2: `note_required_for_done` is yes for Vitals check, Advocacy and note-taking and Post-visit summary (FR-006). |
| A4 | **Confirmed** | §7.2: `visits.booking_id` unique, the partial unique index on `caregiver_id` where `checked_out_at is null`, `visit_note`. One extra column of ours, `created_at`, was **removed** (0020): the spec lists none (TC-VIS-019 asks for exactly id, booking_id, caregiver_id, checked_in_at, checked_out_at, visit_note). |
| A5 | **Confirmed** | §7.8(d): 2,000 characters for a task note and the visit note, 500 for a reason; counted in characters, not bytes (TC-VIS-025). |
| A6 | **Corrected (shape)** | §7.2: `visit_tasks` copies `task_key`, `name`, `sort_order`, `is_required`, `note_required_for_done`; id is `bigint`; UNIQUE (`visit_id`, `task_key`). The draft had a uuid id and `checklist_item_id`. The snapshot idea was right. |
| A7 | **Corrected** | §7.2: `bigint` ids, the highest id counts, a Not done entry needs a reason; and **`logged_by` (a profile, set by the function)** was missing. 0020 adds it, and a CHECK that a Done entry stores no reason ("stored empty when done"). |
| A8 | **Confirmed / Kept** | §7.2 and TC-VIS-036: a closed visit never changes, entries and snapshot rows are never updated or deleted, no entry on a closed visit, no delete of a visit. The wording of the trigger messages (e.g. `VISIT_CLOSED`) is not in the document; **kept**, they are never shown to a user (the functions answer first with `VISIT_ALREADY_CHECKED_OUT`). |
| A9 | **Corrected + Kept** | §7.2: `private.test_clock(caregiver_id uuid primary key, now_override timestamptz)`: per Caregiver, as 0017 had it. The moment column was renamed from `at` to `now_override` (0020). **Kept:** `visit_now()` returns `clock_timestamp()`, the spec says `now()`; the two are the same at the start of any real call, and `clock_timestamp()` keeps two calls inside one test transaction in order. |
| A10 | **Confirmed** | §7.3 step 4 and test 1: `(visit_now() at time zone 'Africa/Nairobi')::date` equals the booking's date; a late check-in is allowed and nothing is stored about lateness. |
| B1 | **Corrected** | §7.3 and TC-VIS-015/016: a Caregiver who is not Verified, or not the assigned one, or an unknown booking, all get **BOOKING_NOT_FOUND** (the draft's `CAREGIVER_NOT_VERIFIED` told them the booking existed); a visit already closed is **VISIT_ALREADY_CHECKED_OUT** (the draft returned it); the reply is `{booking_id, checked_in_at}`. **Kept:** `BOOKING_NOT_ASSIGNED` for a booking that is not assigned (cancelled): §7.3 does not name the code and TC-VIS-016(c) asks for it to be recorded. |
| B2 | **Corrected** | §7.3: arguments (booking id, `task_key`, outcome, note, reason); an unverified, unassigned or unknown booking is **VISIT_NOT_FOUND**; a closed visit **VISIT_ALREADY_CHECKED_OUT**; a note or reason over its limit **TEXT_TOO_LONG**; `logged_by` and `logged_at` set by the function; an identical repeat returns the entry and adds nothing. The draft used a task id and `NOTE_TOO_LONG`, `REASON_TOO_LONG`, `VISIT_CLOSED`. **Kept:** a Not done entry stores no note (the screen has only the reason field; the document is silent), and the reply carries `changed`. |
| B3 | **Corrected** | §7.3: an unverified, unassigned or unknown booking is **VISIT_NOT_FOUND**; the Required tasks are tested **before** the visit-note limit; the limit is **TEXT_TOO_LONG**; the reply is `{booking_id, checked_out_at}`. |
| B4 | **Corrected** | The table of §7.3, row by row, in `lib/visits/action-errors.ts`: BOOKING_NOT_FOUND and VISIT_NOT_FOUND reload into VER-12b; NOT_VISIT_DAY, ANOTHER_VISIT_IN_PROGRESS and REQUIRED_TASKS_MISSING reload into the state that explains them; VISIT_ALREADY_CHECKED_OUT shows "This visit was already checked out. Refresh to see the current state."; TEXT_TOO_LONG "This is too long. The limit is 2,000 characters." (500 for a reason); NOT_CAREGIVER, TASK_NOT_FOUND and INVALID_OUTCOME the generic text of DEV-023/050; connection lost "Not saved. Check your connection and try again. What you typed is still here." |
| C1 | **Corrected** | §7.2: columns booking_id, day_state, checked_in_at, checked_out_at, visit_note, other_visit_booking_id, other_visit_recipient_name, other_visit_bundle_code. The draft added `status` and `visit_id` and named the last three differently. The Verified filter and owner rights are as the spec says; the Tech Lead still reads the filter. |
| C2 | **Corrected** | §7.2: booking_id, task_key, name, sort_order, is_required, note_required_for_done, outcome, note, reason, logged_at (no ids). |
| C3 | **Corrected** | FD-FAMVIS §7.2: `private.visit_task_latest` has exactly visit_task_id, outcome, note, reason, logged_at. The extra `entry_id` was dropped (0020), and a test lists the exact columns. |
| C4 | **Kept, for the Tech Lead** | The document does not mention `private.visit_day_state`. PostgreSQL checks a function a view calls as the caller, so the day-state function must be executable by signed-in users; it returns only before, today or passed, and `private.visit_now()` stays closed (TC-VIS-045 still passes). The alternative is a day state computed inside the view with no function. |
| C5 | **Confirmed** | FD-FAMVIS §7.2: the four columns and the rule for the check-out time and the note are exactly the draft's. |
| C6 | **Corrected** | FD-FAMVIS §7.2: seven columns in this order (booking_id, sort_order, name, outcome, logged_at, reason, note); `outcome` is done, not_done or not_recorded; one row per task of the snapshot when the booking is completed and the visit closed. The draft's extra rule (no rows at all when a Required task has no entry) was **removed**: a hand-made closed visit now shows its unlogged tasks as Not recorded, and the probe lists it. |
| C7 | **Confirmed** | FD-FAMVIS §7.2: `security_barrier = true`, "or whatever DEV-034 uses for `family_bookings`", reviewed by the Tech Lead. |
| C8 | **Built (0020)** | §7.4: the Admin has SELECT on `visits`, `visit_tasks`, `visit_task_entries` and reads `checklist_items`; nobody else reads them and nobody writes. Built as one "admin read" policy each. What remains of DEV-062 (VIZ-67) is its tests: the access matrix of §7.4 over real persona sessions, the Verified-removed-and-restored case, the snapshot case (TC-VIS-040, 041). |
| D1 | **Corrected** | §6.5 verbatim: the Medication assistance description and the if-unsure sentence; the check-in dialog's detail "[Name] · [bundle name only] · [date alone]" and body "The family will see this visit as "In progress". The check-in time is recorded when you confirm." |
| D2 | **Corrected** | §6.5: labels "Readings (required)", "Notes (required)", "Summary (required)", "Note (optional)", "Reason (required)"; the Reason prompt differs by task (seven prompts); no prompt on a plain note; the too-long line has no "Shorten it" tail; the Done and Not done buttons are at least 52px high (TC-VIS-021); the already-checked-out line. |
| D3 | **Corrected** | Same as B4. |
| D4 | **Corrected** | §6.5: the check-out too-long line; the summary's row is "Visit note" (the confirmation's field is "Note about the visit (optional)"). The summary replaces the whole assignment page: **confirmed** by §6.6(e) ("shown once, straight after check-out"). |
| D5 | **Confirmed** | FD-FAMVIS §6.5 copy table: every string of the visit block and the report is the draft's, word for word; the neutral chip is #f5f7fa fill, #7b8794 outline, #1f2933 text at 16px (`StatusChip size="report"`); the order of the report card is §6.1's. |
| D6 | **Confirmed** | §6.1: title, times, recorded-by line, count line, task blocks, then the visit-note card. |
| E1 | **Corrected** | §6.1 and §6.6(f): "the booking summary (recipient, bundle, date and time, **care notes**) is always the top block"; the notice sits directly under it, above the checklist. The draft had put the care notes below the checklist. They are now inside the summary block. |
| E2 | **Confirmed** | §6.6(a): the Medication assistance lines are shown on the checklist before the visit and on Log a task; "the task list during the visit shows names only". |
| E3 | **Kept** | A booking in progress with no visit row: FD-FAMVIS §7.3 says status only and no visit block (the draft's choice); for the Caregiver's page the document says nothing (only test data can make it), so an empty Tasks card and no Check out are kept. |
| E4 | **Confirmed** | FD-FAMVIS §7.3 state table: F1/F6 no block; F2 in progress with a visit row; in progress without one, status only; F3 completed, closed, at least one task; F4 completed and no visit row; F5 a visit row without a check-out time, a closed visit with no task rows, or any failed read. `familyVisitState` follows it row for row. |
| E5 | **Kept** | §7.3: "Try again repeats only the visit reads." The draft's retry also re-reads the booking's status (one more read of `family_bookings`), because the state is chosen from the status and the visit reads together; a stale status could hide a report that has just become available. Small and safe; the Tech Lead or Maya may ask for the literal behaviour. |
| E6 | **Confirmed** | FD-FAMVIS §6.6(j): 640px only "if the shell has no maximum width". The shell has one (672px), so nothing is added. |
| E7 | **Confirmed** | FD-FAMVIS §6.1, §7.3: in progress first, then everything else soonest first, completed newest first, ties by booking id; the chips are the clock and the check. |
| F1 | **Kept** | §7.3 item 13 and TC-VIS-044 name four rules (a booking in progress or completed with no visit; a visit open for a completed booking or closed for one that is not; a visit with no tasks; a visit whose Caregiver is not the booking's). All four are in the probe. The further checks (closed before opened, two open visits, Required task not logged on a closed visit, entry outside the visit, entry without its text) are ours, additive, and cannot fire on a database the functions have kept. Whether to keep them is the Tech Lead's. |
| F2 | **Corrected (VIZ-90); document already current (VIZ-93)** | Test_Data_Strategy.md §3.3 and §7 already say B3, B4 and B5 are 3 Nairobi days out at 09:00, 11:00 and 14:00 and that seedVisit is built from DEV-070, with B6 partly logged and Vitals check left unlogged; B6 and B7 are "in the past", with times inside their day. The seed matches all of that. What the draft data got wrong (starter-set.mjs): names must say "Test"; the recipients are 1A, 1B, 2A, 3A, 4A with the owners fm1, fm1, fm2, fm3, fm4 and 4A the 2,000-character note; B1 and B2 requested for fm1; B3 (MediCheck, cg1) and B4 (Doctor's Day Out, cg2) for fm2; B5 (Doctor's Day Out, cg1) and B8 (MediCheck, cancelled) for fm3; B6 (MediCheck, cg2, in progress) and B7 (MediCheck, cg1, completed) for fm4, sharing one recipient and bundle, which the seed now tells apart by creation order; cg3 has no history (the draft had Verified-then-removed and assigned B4 to cg3); cg1 and cg2 have one "verified" row each, dated 7 days before seeding, note "test seed"; phones are the obviously fake +254000000xxx. B7 is now a MediCheck visit with its three tasks. |
| F3 | **Open (VIZ-94)** | FD-VISIT §5.7(i) and §7.8(g): the Tech Lead corrects by hand, "by disabling a trigger inside one transaction, or a documented correction function", and confirms the procedure. The cases stand; the statements were updated for `logged_by`. Whether to build `private.visit_corrections` is the Tech Lead's decision. |
| F4 | **Open (VIZ-96)** | Waits for the FD-ADMINEXC migration (DEV-079). |

**Not in the draft register, found in the check:** the buttons on Log a task must be at least 52px (TC-VIS-021), they were 48px: **fixed**.
