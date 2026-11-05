# FD-VISIT and FD-FAMVIS: every draft decision, to check against the documents

**Why this exists.** The visit database (migrations 0011 to 0019), the Caregiver's visit screens (DEV-064 to DEV-067), the family's visit block and report (DEV-075 to DEV-078) and the test data (DEV-070, DEV-074) were all built while FD-VISIT, FD-FAMVIS and Test_Data_Strategy.md were **not available**, from the task texts alone. Every choice the task text did not fix is a guess. This is the one list of them, so each can be confirmed or corrected against the documents in a single pass.
**For:** Linear VIZ-91 (the schema, functions, views, wording and layout) and VIZ-92 (the Doctor's Day Out Optional task).
**Status:** written 2026-11-05. **Nothing here has been checked against the documents.** The last column says what each line needs.

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
