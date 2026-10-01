Vizazi Care
FD-ACC — Account & Booking Flow
Document ID	FD-ACC (covers P0-1, P0-2, P0-3)
Feature Name	Account & Booking Flow
Epic	Account & Booking
Product Area	Family Member app — account creation, care-recipient setup, bundle selection, booking request
Personas	Family Member (primary), Admin (secondary — receives the booking request)
Priority	P0
Roadmap Phase	Phase 2 — Execution (MVP_Scope_Beta_Pilot_Launch.md §13)
Owner	Peter (product) — Maya (design) and David (technical) completed sections 6–7
Created	2026-08-28
Last Updated	2026-08-28 — merged after concurrent-edit conflicts; see Decision_Log.md for the Shared Document Protocol note. Peter's login flow (FR-007/US-006/AC-005), name-required/notes-optional (FR-002/AC-004), leave-without-finishing prompt (FR-008/US-007/AC-006), and no-bundle-pricing (BR-005) all merged in alongside Maya's §6 and David's §7.
Status (workflow, tracked in Notion)	DISCOVERY
01. Business Need
1.1 Problem
Families arranging home-based elder care today rely on informal channels (phone calls, WhatsApp, word of mouth) with no structured way to create a relationship with Vizazi Care, register who they need care for, or record what they're requesting.
1.2 Who experiences the problem
Family Member (primary — has no structured way in); Admin (secondary — no visibility into incoming requests without this).
1.3 Why this matters
This is the entry point to the entire product. Every downstream feature — verification visibility, visit execution, family visibility — depends on a family first having an account, a registered care recipient, and a recorded booking. It is also most families' first trust signal.
1.4 Business objective
Take a family from no relationship with Vizazi Care to a recorded, bundle-specific booking request visible to Admin, in one sitting, with no informal channel required.
1.5 Evidence
MVP Hypothesis and Problem Statement, MVP_Scope_Beta_Pilot_Launch.md §2–3.
02. Business Process
2.1 Current process — AS-IS
Care is arranged informally; no record of what was requested, when, or under what terms.
2.2 Future process — TO-BE
Family Member creates an account, adds a care recipient, selects between exactly two bundles (MediCheck, Doctor's Day Out) with visible inclusions/frequency/response-time SLA, selects a date/time, and submits a booking request Admin can see immediately.
2.3 End-to-end flow
Trigger: FM opens the app with no account
•  FM creates account (basic contact info)
•  FM adds a care recipient (name + care notes)
•  FM selects a bundle (sees inclusions, frequency, SLA)
•  FM selects date/time relevant to the chosen bundle
•  System records the booking request
Outcome: booking request visible to Admin, ready for caregiver assignment (→ FD-VERIFY)
2.4 Business rules
Only MediCheck and Doctor's Day Out are offered. A care recipient must exist before a booking request can be submitted. An account may hold multiple care recipients; at least one is required before a booking can be requested (confirmed by founder 2026-08-28, kept simple for Beta). A care recipient's name is required; care notes are optional (Peter product decision 2026-08-28, in response to Maya — see rationale in Decision_Log.md) — a family shouldn't be blocked from registering a recipient just because they don't have detailed notes ready yet, and notes can be added or edited later.
2.5 Exceptions
•  FM attempts to book without a care recipient added — RESOLVED 2026-08-28: blocked; at least one care recipient is required before a booking request can be submitted (see Decision_Log.md).
•  FM abandons the booking flow partway through — partially addressed 2026-08-28: full progress-saving remains a P2 backlog item in Product_Backlog.md (no persistence built this Beta), but a lightweight, non-persistent "leave without finishing" warning is now in scope — see FR-008/AC-006 and §6.6(d) — so data loss is visible to the FM rather than silent.
•  FM's selected date/time becomes unavailable between selection and submission (e.g., concurrent requests for the same slot) — RESOLVED 2026-08-28: no locking/reservation logic for Beta, per §7.7 (see Decision_Log.md).
Note: an earlier Exception 4 covering self-service password/credential recovery was removed here per founder decision 2026-08-28 — out of Beta scope at N=5 families, logged as a future idea in Product_Backlog.md instead (see Decision_Log.md).
03. Feature Definition
3.1 Feature statement
As a Family Member, I want to create an account, add a care recipient, and request a booking for a specific care bundle, so that I can arrange trusted care without relying on informal channels.
3.2 Feature description
Covers account creation, care-recipient profile creation, bundle selection (2 options only), and date/time selection through to a recorded booking request — the full Family Member entry journey.
3.3 Personas
•  Family Member — Primary user, submits everything in this flow.
•  Admin — Receives the resulting booking request; no action within this feature itself.
3.4 In scope
Account creation with basic contact info; returning-user login (implied baseline — an account created here is unusable across sessions without it; confirmed 2026-08-28 in response to Maya, not separately prioritized as its own feature; exact auth mechanism owned by David, login-screen UX by Maya); care-recipient profile (name required, care notes optional) — accounts may hold multiple care recipients, with at least one required before a booking can be requested (confirmed by founder 2026-08-28, kept simple for Beta — see Decision_Log.md); bundle selection UI (exactly 2 options, with inclusions/frequency/SLA shown); date/time selection relevant to the chosen bundle; booking request submission, visible to Admin; a lightweight, non-persistent "leave without finishing" warning from Bundle Selection onward (confirmed 2026-08-28 — see FR-008).
3.5 Out of scope
Booking customization/add-ons (P1, see MVP Scope §5.6); payment at booking time (P1, manual/offline this cycle); Full Circle/Peace of Mind bundles (not shown at all); self-service password/credential recovery (see §2.5 note); persistent saved drafts of an in-progress booking (P2 backlog item — the leave-without-finishing warning in FR-008 is a non-persistent complement, not a substitute).
Whether an account may hold more than one care recipient was not explicitly scoped either way in the source backlog — recommend defaulting to "yes, allow multiple," since the acceptance criteria only require the ability to add one, not a one-recipient limit.
04. Product Requirements
4.1 Functional requirements
ID	Requirement	Priority
FR-001	FM can create an account with basic contact info	P0
FR-002	FM can add a care recipient with a name (required) and care notes (optional)	P0
FR-003	FM sees exactly two bundle options (MediCheck, Doctor's Day Out) with inclusions, frequency, and response-time SLA	P0
FR-004	Full Circle and Peace of Mind bundles are not selectable and not shown	P0
FR-005	FM selects a date/time relevant to the chosen bundle	P0
FR-006	Booking request is recorded and visible to Admin	P0
FR-007	FM can log in to an existing account (implied baseline, confirmed in scope 2026-08-28 — see Decision_Log.md)	P0
FR-008	Show a confirmation prompt ("Leave without finishing? Your progress won't be saved") before the FM exits the booking flow, Bundle Selection onward — non-persistent, saves no data; proposed by Maya, approved by Peter 2026-08-28	P0
4.2 Non-functional requirements
Privacy — care-recipient notes may include sensitive health/care information. For Beta, this data is visible to Admin and the assigned Caregiver in full (confirmed by founder 2026-08-28 — see §7.5 and Decision_Log.md); finer-grained access control is a post-Beta topic, logged in Product_Backlog.md.
Usability — likely many families' first interaction with the product; should be completable without outside assistance.
Reliability — a submitted booking request must not be lost between submission and Admin visibility.
4.3 Business rules
ID	Rule
BR-001	Only MediCheck and Doctor's Day Out are offered this Beta
BR-002	A care recipient must exist before a booking request can be submitted
BR-003	An account may hold multiple care recipients; a minimum of one is required before booking (confirmed 2026-08-28)
BR-004	A care recipient's name is required; care notes are optional (confirmed 2026-08-28)
BR-005	Bundle pricing is not displayed anywhere in-app for Beta (founder decision 2026-08-28) — Bundle Selection shows inclusions, frequency, and response-time SLA only (FR-003), no figures
4.4 Dependencies
None on other features within this document. Feeds FD-VERIFY (assignment needs a booking to assign against) and FD-VISIT (checklist attachment needs the bundle selected here). Login/auth mechanism (FR-007) — David owns the technical approach; Maya owns the login screen UX. Leave-without-finishing prompt (FR-008) — Maya owns exact copy/UI treatment.
05. Feature Specification
5.1 Inputs
FM contact info; care recipient name (required) + care notes (optional); bundle selection; date/time selection.
5.2 Outputs
Account record; care-recipient record; booking-request record (bundle, date/time, status = requested).
5.3 Feature states
Account Created → Recipient Added → Bundle Selected → Booking Requested → (hands to FD-VERIFY for the Assigned state)
5.4 User interactions
See §6.5 Interaction specification — click/submit/cancel/retry behavior defined against the screen inventory below.
5.5 Notifications
Admin needs to see a new booking request as it comes in. RESOLVED 2026-08-28: in-app queue only for Beta — no SMS/push (see §7.6, Decision_Log.md).
5.6 Edge cases
FM attempts to select an unavailable time slot; FM submits incomplete contact info; FM loses connection mid-submission; two family members from the same household independently create separate accounts for the same care recipient (duplicate/shared-account handling — not in scope for Beta; logged as a possible future feature, shared/household accounts, in Product_Backlog.md).
06. UX / Design — Maya, 2026-08-28
Design approach: per founder decision (2026-08-28), all screens below are designed fresh in Figma rather than adapted from the pre-existing, undocumented Figma mockup. That earlier file was not used as a source for this section — it had no traceable requirements, and several Beta decisions (bundle restriction, manual assignment, no GPS, 30-minute check-in threshold, full care-data visibility) postdate it.
6.1 User flow
Trigger: FM opens the app with no account
•  Sign Up (email, password, full name, phone) [FR-001, AC-001] — invalid email / weak password / missing field → inline error, stays on screen, no account created
•  Account created → routed into the Care Recipient step
•  Care Recipient List — zero recipients: "Add your first care recipient" empty state; one or more: list shown, each with "Book care for [name]", plus "Add another recipient"
•  Add Care Recipient — name required, care notes optional (FR-002, AC-004) — missing name → inline error; blank care notes submits successfully
•  Recipient saved → returns to Care Recipient List
•  FM selects which recipient the booking is for — exactly 1 recipient: auto-selected, step skipped; 2+ recipients: explicit "Who is this booking for?" screen
•  Bundle Selection — MediCheck or Doctor's Day Out only [FR-003, FR-004, AC-002]
•  Date/Time Selection — options relevant to the chosen bundle [FR-005] (MediCheck is a daily 3-hour visit; Doctor's Day Out is a single 4–5 hour appointment-day booking)
•  Booking Review — recipient, bundle, date/time summary, each with an "Edit" link back to that step
•  Submit — loading state disables the button to prevent double-submit; connection loss/error retains entered data in memory and offers retry
•  Booking Confirmation — "Request received. We'll confirm your caregiver soon." [FR-006]
Outcome: booking appears in the Admin Booking Queue, status = requested, ready for FD-VERIFY.
Branch — Returning FM: Log In → Care Recipient List (Sign Up is skipped). Confirmed in scope 2026-08-28 as an implied baseline of account creation.
Branch — FM leaves mid-flow (Bundle Selection onward): a "Leave without finishing? Your progress won't be saved" confirmation prompt appears (FR-008, AC-006); if they confirm leaving, no progress is saved (full draft-saving remains a P2 backlog item).
6.2 Wireframes
Figma link: TBD. Wireframes are to be built fresh in Figma, per the founder's redesign-from-scratch decision (2026-08-28). This session has no Figma-authoring tool available — the only connected Figma capability is read-oriented (dev-mode context/screenshots from an existing file), so screen-building itself happens by hand from this spec.
6.3 High-fidelity design
Figma link: TBD. High-fidelity screens follow wireframe sign-off. Bundle content and pricing display are both resolved (§6.6) — no open blockers remain before high-fidelity work can begin.
6.4 Screen inventory
Screen	Persona	Purpose
Sign Up	Family Member	Create account (FR-001, AC-001)
Log In	Family Member	Entry point for returning FMs (FR-007, AC-005)
Care Recipient List (incl. first-time empty state)	Family Member	View/add recipients; entry point into booking (FR-002, BR-003)
Add Care Recipient	Family Member	Capture name (required) + care notes (optional) (FR-002, AC-004)
Who is this booking for?	Family Member	Select recipient when 2+ exist (shown only when applicable)
Bundle Selection	Family Member	Choose MediCheck or Doctor's Day Out only — inclusions/frequency/SLA shown, no pricing (FR-003, FR-004, AC-002, BR-005)
Date/Time Selection	Family Member	Choose date/time relevant to the selected bundle (FR-005)
Booking Review	Family Member	Confirm details before submitting; edit any prior step
Booking Confirmation	Family Member	Confirms the request was received, sets expectation for what happens next (FR-006)
Leave Without Finishing (modal, Bundle Selection onward)	Family Member	Warns that progress won't be saved before exiting the booking flow (FR-008, AC-006)
Admin Booking Queue	Admin	View incoming requests, status = requested (FR-006, §7.6 — in-app queue only, no action buttons)
Error / Retry (global pattern)	Family Member	Recovery from connection loss or submission failure (§5.6)
6.5 Interaction specification
General patterns
•  Validation is inline, on blur — not only on submit — with errors named in plain language next to the field they belong to.
•  Every primary action button shows a "Submitting…"/"Saving…" state and disables itself during any network call, to prevent double-submission — this matters more here because no slot-locking exists, so a double-tap is currently the most likely path to an accidental duplicate booking.
•  Back/Cancel is available at every step after Sign Up's first field. Cancelling out of the booking flow (Bundle Selection onward) triggers the leave-without-saving prompt (FR-008, AC-006).
•  Tap targets are a minimum of ~44x44pt on all buttons and form controls — Family Members may be older, or using the app one-handed while attending to something else.
•  Status is never conveyed by color alone (form validation, submission success) — always paired with an icon or text label.
Screen-specific
Screen	Key interaction	System response	Edge case handling
Sign Up	Submit form	Creates Supabase Auth user + profile row; routes to Care Recipient List	Invalid email / weak password / missing field → inline error, no account created
Log In	Submit credentials	Authenticates via Supabase Auth; routes to Care Recipient List	Invalid credentials → generic error, no password-recovery link this Beta
Add Care Recipient	Submit form	Inserts care_recipients row; returns to list	Missing name → inline error; blank care_notes allowed (BR-004)
Bundle Selection	Tap a bundle card	Highlights selection, enables Continue	Full Circle / Peace of Mind not rendered at all; no pricing figures rendered (BR-005)
Date/Time Selection	Tap an available slot	Highlights selection, enables Continue	Slot can become unavailable before submit (no locking) — copy must not imply the slot is held
Booking Review	Tap Submit	Loading state → success routes to Confirmation	Connection loss/error → retry, data retained in memory; no duplicate booking on re-tap
Leave Without Finishing (modal)	FM taps Back/Cancel/navigates away, Bundle Selection onward	Modal: "Leave without finishing? Your progress won't be saved." with Stay/Leave options	Confirming Leave discards all in-progress selections; no data persisted (FR-008)
Booking Confirmation	—	Displays booking summary + "we'll confirm your caregiver soon"	—
Admin Booking Queue	View only, within this feature	Lists bookings where status = requested	Empty state: "No new requests." No assignment action here — that's FD-VERIFY
Trust/transparency note (care sensitivity): the Add Care Recipient screen should carry short microcopy near the care_notes field disclosing that this information will be visible to Admin and to the caregiver assigned to this recipient's booking, per the founder's full-visibility decision. Stating this upfront, before the FM types anything sensitive, is more trustworthy than leaving it implicit — and costs nothing to build.
6.6 Open items surfaced by this section
•  (a) RESOLVED — Bundle content found in COMPANY-FACTS.md §9. MediCheck Plan: 3-hour daily visit; medication administration, vitals check (BP/glucose), companionship; SLA — emergency response <30 min, missed-meds alert <15 min; daily "MediCheck Report" in-app. Doctor's Day Out: 4–5 hr, day-of-appointment; pre-visit prep, transport & escort, advocacy/note-taking, post-visit report; SLA — emergency response <15 min, dedicated hotline; "Clinic Visit Report" in-app.
•  (b) RESOLVED — care_notes is optional (Peter; BR-004, AC-004).
•  (c) RESOLVED — Log In confirmed in scope as a baseline of account creation (Peter/founder; FR-007, AC-005).
•  (d) RESOLVED — "Leave without finishing?" prompt, Bundle Selection onward, approved by Peter as P0 (FR-008, AC-006). Complements, does not replace, the P2 save-drafts backlog item.
•  (e) RESOLVED — Bundle pricing will NOT be displayed anywhere in-app for Beta (founder decision). See BR-005.
07. Technical Specification — David, 2026-08-28
Scope note: this spec covers only what FD-ACC needs to build (account creation → care recipient → bundle selection → booking request, ending in status = "requested"). It defines the bookings table's full shape now — including fields FD-ACC doesn't populate — so FD-VERIFY and FD-VISIT don't force a schema rework later.
TECHNICAL RISK: no Technical Architecture Reference document exists yet in the project, and this session has no access to the actual GitHub codebase or Supabase project — this spec is derived from company-facts.md §14 and the Feature Dev docs only. Everything below marked ASSUMPTION should be confirmed against the real codebase/environment during Week 2 Technical Discovery.
7.1 Technical architecture reference
•  ASSUMPTION: Supabase Postgres as primary datastore[MW1.1], Supabase Auth for identity, PostgREST as the main API layer, consumed directly by the client with Row-Level Security (RLS) enforcing access — the standard, simplest Supabase pattern.
•  GAP: frontend framework/repo structure is not documented anywhere in the project. Needs confirming with the Tech Lead in Week 2.
•  RECOMMENDATION: produce a one-page Technical Architecture Reference as a Week 2 deliverable, shared across all 5 Feature Dev docs.
7.2 Database — tables/entities required
Table	Key columns	Notes
profiles	id (uuid, PK = auth.users.id), role (enum: family_member, admin, caregiver), full_name, phone, email, created_at	Extends Supabase's built-in auth.users with app-level role and contact info. Caregiver role exists here now because FD-VERIFY will need it.
care_recipients	id (uuid, PK), account_id (FK → profiles.id, NOT NULL), name, care_notes (text), created_at	care_notes is the sensitive field — see §7.5. Beta ships with a single free-text notes field.
bookings	id (uuid, PK), account_id (FK), care_recipient_id (FK, NOT NULL), bundle_code (enum), requested_datetime, status (enum: requested/assigned/in_progress/completed/cancelled), assigned_caregiver_id (FK, NULL), created_at	FD-ACC only ever writes status='requested'. Later states/columns populated by FD-VERIFY and FD-VISIT.

TECHNICAL DECISION[MW2.1]: bundles are modeled as a fixed enum (bundle_code), not a separate editable bundles table — MVP Scope §5.6 excludes booking customization and only 2 bundles exist this Beta.
7.3 APIs — required endpoints/integrations
Standard Supabase pattern: reads/writes go through PostgREST directly from the client, protected by RLS. No custom backend service is needed for FD-ACC specifically.
Operation	Mechanism	Notes
Account creation	Supabase Auth (signup)	DECIDED: email/password for Beta. Phone-OTP planned near-term, logged in Product_Backlog.md.
Add care recipient	PostgREST insert on care_recipients	RLS restricts account_id to auth.uid().
List own recipients	PostgREST select on care_recipients	RLS-scoped.
Submit booking request	PostgREST insert on bookings	BR-001/BR-002 enforced at the database level (enum + NOT NULL FK).
Admin booking queue	PostgREST select on bookings where status='requested'	RLS: admin role only.
7.4 Authentication & authorisation
•  Identity: Supabase Auth, email/password for Beta. Role stored in profiles.role, checked by RLS policies.
•  Admin accounts provisioned manually by the Tech Lead/founder — no public admin signup route.
•  Family Member: full CRUD on own care_recipients and bookings only, no access to other families' data.
•  Admin: read access to all bookings and full read access to care_recipients data including care_notes.
•  Caregiver: no access under FD-ACC. Once FD-VERIFY assigns a caregiver, that caregiver gets full read access to the linked care_recipient's data.
7.5 Security & privacy
DECIDED (founder, 2026-08-28): for Beta, all care_recipient data — including care_notes — is fully visible to Admin and to the Caregiver assigned to that recipient's booking, given both pilot caregivers are fully verified before assignment.
The broader care-recipient data model (mandatory vs. optional fields, notes format, media/document attachments) and more granular future visibility are logged in Product_Backlog.md for post-Beta scoping.
DEFERRED, not a Beta blocker: Kenya's Data Protection Act 2019 applicability. Founder has flagged this as a larger topic for later; handoff to Bella/founder when that workstream starts.
Standard Supabase encryption at rest/in transit is assumed sufficient at this scale (5 families). No payment data touches this feature (manual/offline this cycle).
7.6 External services
None required for FD-ACC as scoped. GPS/Maps and M-Pesa are explicitly out of scope. DECIDED (founder, 2026-08-28): ship Beta with an in-app Admin queue only — no SMS/push/WhatsApp integration. Revisit as P1 if Admin actually misses requests during the pilot.
7.7 Technical dependencies
•  Supabase Auth and the profiles role model must be configured before care_recipients/bookings RLS can be written.
•  FD-ACC and FD-VERIFY are built in parallel and share the bookings table; the status enum and assigned_caregiver_id column are the shared contract.
•  DECIDED: no locking/reservation logic for the double-booking race — a plain insert is sufficient at N=5 families/2 caregivers. Revisit as P1 only if real double-bookings occur.
•  Depends on the Tech Lead review-gate checkpoints being scheduled during Week 2 before Weeks 4–5 development begins.
7.8 Open items surfaced by this spec
•  (a) Frontend stack / existing codebase state — still OPEN. Tech Lead, Week 2.[MW3.1]
•  (b) RESOLVED — email/password for Beta signup; phone-OTP logged as a future feature.
•  (c) RESOLVED — in-app queue only for Admin notifications.
•  (d) RESOLVED for Beta — full care_notes visibility to Admin and assigned Caregiver.
•  (e) Kenya Data Protection Act applicability — still OPEN, explicitly DEFERRED by founder to a later, separate workstream.
08. User Stories
US-001 — As a Family Member, I want to create an account with my basic contact info, so that Vizazi Care can identify me and my bookings.
US-002 — As a Family Member, I want to add a care recipient with their name and relevant care notes, so that Vizazi Care knows who the care is for.
US-003 — As a Family Member, I want to see exactly two bundle options with their inclusions, frequency, and response-time SLA, so that I can choose the care that matches my recipient's needs.
US-004 — As a Family Member, I want to select a date/time relevant to my chosen bundle, so that I can request care when it's needed.
US-005 — As an Admin, I want to see new booking requests as they come in, so that I can begin the caregiver assignment process.
US-006 — As a returning Family Member, I want to log in to my existing account, so that I can access my care recipients and bookings across sessions.
US-007 — As a Family Member, I want a warning before I exit the booking flow without finishing, so that I know my progress won't be saved and can decide whether to continue or leave.
09. Acceptance Criteria
AC-001 — Account creation
Given a new Family Member with no account, when they submit basic contact info, then an account is created and they can proceed to add a care recipient.
AC-002 — Bundle restriction
Given a Family Member on the bundle selection screen, when the screen loads, then only MediCheck and Doctor's Day Out are shown, with no way to select Full Circle or Peace of Mind.
AC-003 — Booking visible to Admin
Given a Family Member has selected a bundle and a date/time, when they submit the booking request, then the request is recorded and appears to Admin without further action from the Family Member.
AC-004 — Care notes are optional
Given a Family Member adding a care recipient, when they submit a name but leave care notes blank, then the care recipient is still successfully added.
AC-005 — Returning-user login
Given a Family Member with an existing account, when they provide valid login credentials, then they gain access to their account, including their care recipients and bookings.
AC-006 — Leave-without-finishing warning
Given a Family Member is at Bundle Selection or a later step in the booking flow, when they attempt to exit or cancel out of the flow, then a confirmation prompt appears stating their progress won't be saved, with the option to stay or leave; no data is persisted if they choose to leave.
10. Development Tasks
To be populated with David in Week 2–3, per the finalized technical spec.
11. Sprint
Sprint 1 (per delivery plan §6, Weeks 4–5), alongside FD-VERIFY.
12. Testing
Quinn to build test cases in Week 3 against AC-001–006 and the Success Metrics in MVP_Scope_Beta_Pilot_Launch.md §11 (Adoption: all 5 families complete at least one full cycle).
13. Release
Per delivery plan §6, target Oct 7–10, 2026.
14. Product Performance & Learning
Post-release, tied to MVP Scope §11 Adoption metrics.
15. Decision Log
Founder- and Peter-confirmed decisions from this feature are logged in Decision_Log.md (2026-08-28): in-app-only Admin notifications, no booking-slot locking for Beta, email/password signup for Beta, full care-recipient data visibility for Admin/Caregiver for Beta, care-recipient name required/notes optional, Log In confirmed as implied baseline scope, self-service password recovery excluded from Beta (moved to Product_Backlog.md), the founder's redesign-from-scratch decision for §6 UX/Design, the leave-without-finishing warning (FR-008/AC-006), and no bundle pricing shown in Beta (BR-005).
