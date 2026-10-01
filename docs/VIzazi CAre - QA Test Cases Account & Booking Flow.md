Vizazi Care — QA Test Cases: Account & Booking Flow
Source document:  FD-ACC §12 (Testing)
Maps to:  AC-001–AC-006
Automation target:  DEV-024 — GitHub → Playwright pipeline (quality gate on push, no separate staging environment)
Prepared by:  Quinn, QA & Testing Specialist
Date:  2026-09-04
Scope
Scripted test cases against AC-001–006, written to run as Playwright specs through DEV-024's GitHub → Playwright pipeline — the quality gate on every push, since there is no separate staging environment. These test cases are what gives confidence the account-and-booking cycle itself doesn't break; they sit upstream of MVP_Scope_Beta_Pilot_Launch.md §11's Adoption metric (all 5 families complete at least one full cycle), not a direct test of that metric.
Prioritization logic
Risk-based, per company-facts §18.6 MVP discipline — this is the entire critical path for Beta, so nothing here is "nice to have," but within that:
●	P0 — blocks the core flow or fails silently if broken (a lost booking, a duplicate booking, a bundle rule bypassed).
●	P1 — matters but has a visible symptom and/or a narrow trigger condition.
Test cases
Test ID	Maps to	Pri.	Precondition	Steps	Expected Result
TC-ACC-001	AC-001 (happy path)	P0	FM has no account	1. Go to Sign Up. 2. Enter valid full name, email, phone, password. 3. Submit.	Account created (auth.users + profiles row); FM routed to Care Recipient List, first-time empty state.
TC-ACC-002	AC-001 (negative)	P0	FM has no account	1. Go to Sign Up. 2. Enter an invalid email format. 3. Submit.	Inline error on the email field; no account created; FM stays on Sign Up.
TC-ACC-003	AC-001 (negative)	P1	FM has no account	1. Go to Sign Up. 2. Leave a required field blank (e.g. full name). 3. Submit.	Inline error on the blank field; no account created.
TC-ACC-004	AC-002 (happy path)	P0	FM logged in, ≥1 care recipient exists	1. Proceed to Bundle Selection.	Exactly two cards render — MediCheck, Doctor's Day Out — each showing inclusions/frequency/SLA and no price. Full Circle and Peace of Mind are not rendered anywhere on the screen (not greyed-out, not present).
TC-ACC-005	AC-002 (negative, API-level)	P0	Authenticated FM session (valid JWT), bypassing the UI	1. Send a direct PostgREST insert to bookings with bundle_code set to a value outside the enum (e.g. "full_circle").	Insert rejected at the database level (enum constraint violation); no booking row created. Confirms BR-001 holds even if a client bypasses the UI — the enum is the actual enforcement point (§7.3), not the screen.
TC-ACC-006	AC-003 (happy path)	P0	FM has selected a bundle and date/time, on Booking Review	1. Tap Submit.	Booking row inserted with status='requested'; FM sees "Submitting…" disabled-button state, then Booking Confirmation; the same booking appears in Admin Booking Queue with no Admin action taken.
TC-ACC-007	AC-003 (edge — double-submit)	P0	FM on Booking Review	1. Tap Submit, then immediately tap it again (or simulate a slow response and tap again before it returns).	Exactly one booking row is created; the button disables after the first tap so the second tap has no effect. The only real safeguard against a duplicate booking, since no slot-locking exists (§6.5).
TC-ACC-008	AC-004 (happy path)	P0	FM adding a care recipient	1. Enter a name. 2. Leave care notes blank. 3. Submit.	care_recipients row created with care_notes null/empty; FM returned to Care Recipient List showing the new recipient.
TC-ACC-009	AC-004 (negative, inverse)	P1	FM adding a care recipient	1. Leave name blank (optionally fill care notes). 2. Submit.	Inline error on the name field; no care_recipients row created (BR-004).
TC-ACC-010	AC-005 (happy path)	P0	FM has an existing account, logged out	1. Go to Log In. 2. Enter valid email + password. 3. Submit.	FM authenticated, routed to Care Recipient List showing their existing recipients and bookings.
TC-ACC-011	AC-005 (negative)	P1	FM has an existing account, logged out	1. Log In with a valid email + wrong password. 2. Separately, Log In with a non-existent email.	Both cases return the identical generic error ("email or password incorrect") — must not be distinguishable, per §6.5 account-enumeration hygiene. No access granted in either case.
TC-ACC-012	AC-006 (happy path)	P0	FM at Bundle Selection or later, with unsaved selections	1. Tap Back/Cancel/navigate away. 2a. Tap Leave. 2b. (separate run) Tap Stay.	Modal "Leave without finishing? Your progress won't be saved" appears with Stay/Leave. Leave → selections discarded, nothing persisted, FM exits. Stay → modal dismisses, selections intact.
TC-ACC-013	AC-006 (boundary)	P1	FM before Bundle Selection (Sign Up, Care Recipient List, or Add Care Recipient)	1. Tap Back/Cancel/navigate away.	No leave-without-finishing modal appears — FR-008/AC-006 scope is "Bundle Selection onward" only; earlier steps exit normally.
TC-ACC-014	Cross-cutting (AC-003 reliability, NFR §4.2)	P0	FM on Booking Review, Submit tapped	1. Simulate connection loss or a server error immediately after Submit.	"Couldn't submit — check your connection and try again" shown; prior selections remain in memory; Retry re-enables the button and, on success, creates exactly one booking (not zero, not two).
Actual Result / Pass-Fail / Bug ID are not pre-filled here — they're populated per-run in the Playwright pipeline's own output (DEV-024), not authored in this doc. Test ID should match the Playwright test name 1:1 so a failing CI run maps back to this table without translation.
Open dependency — flagged for David, not resolved here
None of TC-ACC-001–014 specify how test data is isolated or reset between CI runs. Since DEV-024 confirms no separate staging environment, these presumably run against a dev/test Supabase project on every push — but without a seeding/reset strategy, tests that create accounts, care recipients, and bookings (nearly all of them) will either collide with leftover data from prior runs or need each test to generate unique data (e.g. randomized emails) and clean up after itself. This isn't decided anywhere in §7 or §10. Recommend David resolve it as part of DEV-024 before that task is marked done — otherwise the pipeline will be flaky in a way that looks like product bugs.
What this document does not cover
Real-device/field testing, exploratory testing, and UAT with actual pilot families are not scripted here — those are better run time-boxed and observationally once a build exists to put in front of someone, not pre-scripted. Recommend a short UAT pass (goal: “create an account and book a MediCheck visit for your relative,” not a step-by-step script) once DEV-001–024 are merged and before Release, watching for hesitation points rather than just pass/fail. Not yet scheduled — flagging for Peter/founder to slot into the Sprint 1 → Release window.
Exit criteria
●	All P0 test cases pass: TC-ACC-001, 002, 004–008, 010, 012, 014.
●	Zero known data-loss or duplicate-booking bugs.
●	TC-ACC-005 (the AC-002 enum-enforcement case) passes specifically — a UI-only pass would be a false confidence signal, since the UI restriction alone doesn't prove BR-001 holds.
●	P1 cases failing at the merge point is a “known issue with a tracked follow-up” decision for Peter, not an automatic blocker — but should be a deliberate call, not silence.
Next handoff
David — implement DEV-024's pipeline against the test IDs above 1:1, and resolve the CI test-data strategy (Open dependency, above) before closing that task.
