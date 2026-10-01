Vizazi Care — Feature Dev Document
Document ID: FD-ACC (covers P0-1, P0-2, P0-3)
Feature Name: Account & Booking Flow
Epic: Account & Booking
Product Area: Family Member app — account creation, care-recipient setup, bundle selection, booking request
Personas: Family Member (primary), Admin (secondary — receives the booking request)
Priority: P0
Roadmap Phase: Phase 2 — Execution (MVP_Scope_Beta_Pilot_Launch.md §13)
Owner: Peter (product) — Maya (design) and David (technical) completed sections 6–7
Created: 2026-08-28
Last Updated: 2026-09-04 (Peter — §11 Sprint built out to match Feature_Dev_Template.md’s §11 structure: added Dates and Sprint Goal, confirmed all 26 §10 tasks map to Sprint 1; Quinn — §12 built out with scripted Playwright test cases against AC-001–006, to run through DEV-024’s pipeline)
Status (workflow, tracked in Notion): DISCOVERY
Table of Contents
•	01. Business Need
•	02. Business Process
•	03. Feature Definition
•	04. Product Requirements
•	05. Feature Specification
•	06. UX / Design
•	07. Technical Specification
•	08. User Stories
•	09. Acceptance Criteria
•	10. Development Tasks
•	11. Sprint
•	12. Testing
•	13. Release
•	14. Product Performance & Learning
•	15. Decision Log
01. Business Need
1.1 Problem
Families arranging home-based elder care today rely on informal channels (phone calls, WhatsApp, word of mouth) with no structured way to create a relationship with Vizazi Care, register who they need care for, or record what they’re requesting.
1.2 Who experiences the problem
Family Member (primary — has no structured way in); Admin (secondary — no visibility into incoming requests without this).
1.3 Why this matters
This is the entry point to the entire product. Every downstream feature — verification visibility, visit execution, family visibility — depends on a family first having an account, a registered care recipient, and a recorded booking. It is also most families’ first trust signal.
1.4 Business objective
Take a family from no relationship with Vizazi Care to a recorded, bundle-specific booking request visible to Admin, in one sitting, with no informal channel required.
1.5 Evidence
MVP Hypothesis and Problem Statement, MVP_Scope_Beta_Pilot_Launch.md §2–3.
02. Business Process
2.1 Current process — AS-IS
Care is arranged informally; no record of what was requested, when, or under what terms.
2.2 Future process — TO-BE
Family Member creates an account, adds a care recipient, selects between exactly two bundles (MediCheck, Doctor’s Day Out) with visible inclusions/frequency/response-time SLA, selects a date/time, and submits a booking request Admin can see immediately.
2.3 End-to-end flow
Trigger: FM opens the app with no account
↓ FM creates account (basic contact info)
↓ FM adds a care recipient (name + care notes)
↓ FM selects a bundle (sees inclusions, frequency, SLA)
↓ FM selects date/time relevant to the chosen bundle
↓ System records the booking request
Outcome: booking request visible to Admin, ready for caregiver assignment (→ FD-VERIFY)
2.4 Business rules
Only MediCheck and Doctor’s Day Out are offered. A care recipient must exist before a booking request can be submitted. An account may hold multiple care recipients; at least one is required before a booking can be requested (confirmed by founder 2026-08-28, kept simple for Beta). A care recipient’s name is required; care notes are optional (Peter product decision 2026-08-28, in response to Maya — see rationale in Decision_Log.md) — a family shouldn’t be blocked from registering a recipient just because they don’t have detailed notes ready yet, and notes can be added or edited later.
2.5 Exceptions
1.	FM attempts to book without a care recipient added — RESOLVED 2026-08-28: blocked; at least one care recipient is required before a booking request can be submitted (see Decision_Log.md).
2.	FM abandons the booking flow partway through — partially addressed 2026-08-28: full progress-saving remains a P2 backlog item in Product_Backlog.md (no persistence built this Beta), but a lightweight, non-persistent “leave without finishing” warning is now in scope — see FR-008/AC-006 and §6.6(d) — so data loss is visible to the FM rather than silent.
3.	FM’s selected date/time becomes unavailable between selection and submission (e.g., concurrent requests for the same slot) — RESOLVED 2026-08-28: no locking/reservation logic for Beta, per §7.7 (see Decision_Log.md).
Note: an earlier Exception 4 covering self-service password/credential recovery was removed here per founder decision 2026-08-28 — out of Beta scope at N=5 families, logged as a future idea in Product_Backlog.md instead (see Decision_Log.md).
03. Feature Definition
3.1 Feature statement
As a Family Member, I want to create an account, add a care recipient, and request a booking for a specific care bundle, so that I can arrange trusted care without relying on informal channels.
3.2 Feature description
Covers account creation, care-recipient profile creation, bundle selection (2 options only), and date/time selection through to a recorded booking request — the full Family Member entry journey.
3.3 Personas
Family Member — Primary user, submits everything in this flow.
Admin — Receives the resulting booking request; no action within this feature itself.
3.4 In scope
Account creation with basic contact info; returning-user login (implied baseline — an account created here is unusable across sessions without it; confirmed 2026-08-28 in response to Maya, not separately prioritized as its own feature; exact auth mechanism owned by David, login-screen UX by Maya); care-recipient profile (name required, care notes optional) — accounts may hold multiple care recipients, with at least one required before a booking can be requested (confirmed by founder 2026-08-28, kept simple for Beta — see Decision_Log.md); bundle selection UI (exactly 2 options, with inclusions/frequency/SLA shown); date/time selection relevant to the chosen bundle; booking request submission, visible to Admin; a lightweight, non-persistent “leave without finishing” warning from Bundle Selection onward (confirmed 2026-08-28 — see FR-008).
3.5 Out of scope
Booking customization/add-ons (P1, see MVP Scope §5.6); payment at booking time (P1, manual/offline this cycle); Full Circle/Peace of Mind bundles (not shown at all); self-service password/credential recovery (see §2.5 note); persistent saved drafts of an in-progress booking (P2 backlog item — the leave-without-finishing warning in FR-008 is a non-persistent complement, not a substitute).
Whether an account may hold more than one care recipient was not explicitly scoped either way in the source backlog — recommend defaulting to “yes, allow multiple,” since the acceptance criteria only require the ability to add one, not a one-recipient limit.
04. Product Requirements
4.1 Functional requirements
ID	Requirement	Priority
FR-001	FM can create an account with basic contact info	P0
FR-002	FM can add a care recipient with a name (required) and care notes (optional)	P0
FR-003	FM sees exactly two bundle options (MediCheck, Doctor’s Day Out) with inclusions, frequency, and response-time SLA	P0
FR-004	Full Circle and Peace of Mind bundles are not selectable and not shown	P0
FR-005	FM selects a date/time relevant to the chosen bundle	P0
FR-006	Booking request is recorded and visible to Admin	P0
FR-007	FM can log in to an existing account (implied baseline, confirmed in scope 2026-08-28 — see Decision_Log.md)	P0
FR-008	Show a confirmation prompt (“Leave without finishing? Your progress won’t be saved”) before the FM exits the booking flow, Bundle Selection onward — non-persistent, saves no data; proposed by Maya, approved by Peter 2026-08-28 as a lightweight complement to the P2 save-drafts backlog item	P0
4.2 Non-functional requirements
Privacy — care-recipient notes may include sensitive health/care information. For Beta, this data is visible to Admin and the assigned Caregiver in full (confirmed by founder 2026-08-28 — see §7.5 and Decision_Log.md); finer-grained access control is a post-Beta topic, logged in Product_Backlog.md.
Usability — likely many families’ first interaction with the product; should be completable without outside assistance.
Reliability — a submitted booking request must not be lost between submission and Admin visibility.
4.3 Business rules
ID	Rule
BR-001	Only MediCheck and Doctor’s Day Out are offered this Beta
BR-002	A care recipient must exist before a booking request can be submitted
BR-003	An account may hold multiple care recipients; a minimum of one is required before booking (confirmed 2026-08-28)
BR-004	A care recipient’s name is required; care notes are optional (confirmed 2026-08-28)
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
→ Sign Up (email, password, full name, phone) [FR-001, AC-001]
⤷ Invalid email / weak password / missing field → inline error, stays on screen, no account created
→ Account created → routed into the Care Recipient step
→ Care Recipient List
•	Zero recipients (first-time state): “Add your first care recipient” → Add Care Recipient form
•	One or more recipients: list shown, each with “Book care for [name]”; plus “Add another recipient”
→ Add Care Recipient — name required, care notes optional (FR-002, AC-004, confirmed by Peter 2026-08-28)
⤷ Missing name → inline error; blank care notes submits successfully
→ Recipient saved → returns to Care Recipient List
→ FM selects which recipient the booking is for
•	Exactly 1 recipient: auto-selected, this step is skipped
•	2+ recipients: explicit “Who is this booking for?” screen
→ Bundle Selection — MediCheck or Doctor’s Day Out only [FR-003, FR-004, AC-002]
→ Date/Time Selection — options relevant to the chosen bundle [FR-005] (MediCheck is a daily 3-hour visit; Doctor’s Day Out is a single 4–5 hour appointment-day booking — see §6.6(a))
→ Booking Review — recipient, bundle, date/time summary, each with an “Edit” link back to that step
→ Submit
⤷ Loading: button reads “Submitting…”, disabled — prevents double-submit (the only real safeguard against a duplicate booking, since no slot-locking exists per Decision_Log.md)
⤷ Connection loss / server error: “Couldn’t submit — check your connection and try again”; entered data is retained in memory so the FM isn’t asked to redo the whole flow; retry re-enables the button
→ Booking Confirmation — “Request received. We’ll confirm your caregiver soon.” [FR-006]
Outcome: booking appears in the Admin Booking Queue, status = requested, ready for FD-VERIFY.
Branch — Returning FM: Log In → Care Recipient List (Sign Up is skipped). Confirmed in scope 2026-08-28 as an implied baseline of account creation (Decision_Log.md) — no longer an open item.
Branch — FM leaves mid-flow (Bundle Selection onward): a “Leave without finishing? Your progress won’t be saved” confirmation prompt appears (FR-008, AC-006, confirmed 2026-08-28 — see §6.6(d)); if they confirm leaving, no progress is saved (full draft-saving is a P2 backlog item, not this Beta).
6.2 Wireframes
Figma link: TBD. Wireframes are to be built fresh in Figma, per the founder’s redesign-from-scratch decision (2026-08-28). Note: this session has no Figma-authoring tool available — the only connected Figma capability is read-oriented (dev-mode context/screenshots from an existing file), so screen-building itself happens by hand from this spec. This section will be updated with the file link once wireframing starts.
6.3 High-fidelity design
Figma link: TBD. High-fidelity screens follow wireframe sign-off. Bundle content is now available (§6.6(a), resolved) and pricing display is resolved (§6.6(e) — no pricing shown) — no open blockers remain before high-fidelity work can begin.
6.4 Screen inventory
Screen	Persona	Purpose
Sign Up	Family Member	Create account (FR-001, AC-001)
Log In	Family Member	Entry point for returning FMs (FR-007, AC-005)
Care Recipient List (incl. first-time empty state)	Family Member	View/add recipients; entry point into booking (FR-002, BR-003)
Add Care Recipient	Family Member	Capture name (required) + care notes (optional) (FR-002, AC-004)
Who is this booking for?	Family Member	Select recipient when 2+ exist (shown only when applicable)
Bundle Selection	Family Member	Choose MediCheck or Doctor’s Day Out only — inclusions/frequency/SLA shown, no pricing (FR-003, FR-004, AC-002, BR-005)
Date/Time Selection	Family Member	Choose date/time relevant to the selected bundle (FR-005)
Booking Review	Family Member	Confirm details before submitting; edit any prior step
Booking Confirmation	Family Member	Confirms the request was received, sets expectation for what happens next (FR-006)
Leave Without Finishing (modal, Bundle Selection onward)	Family Member	Warns that progress won’t be saved before exiting the booking flow (FR-008, AC-006)
Admin Booking Queue	Admin	View incoming requests, status = requested (FR-006, §7.6 — in-app queue only, no action buttons; assignment is FD-VERIFY’s screen, not built here)
Error / Retry (global pattern)	Family Member	Recovery from connection loss or submission failure (§5.6)
6.5 Interaction specification
General patterns (apply across all screens rather than repeated per screen):
•	Validation is inline, on blur — not only on submit — and errors are named in plain language next to the field they belong to.
•	Every primary action button shows a “Submitting…”/“Saving…” state and disables itself during any network call, to prevent double-submission — this matters more than usual here because no slot-locking exists (Decision_Log.md), so a double-tap is currently the most likely path to an accidental duplicate booking.
•	Back/Cancel is available at every step after Sign Up’s first field. Cancelling out of the booking flow (Bundle Selection onward) triggers the leave-without-saving prompt (FR-008, AC-006).
•	Tap targets are a minimum of ~44x44pt on all buttons and form controls — Family Members may be older, or using the app one-handed while attending to something else.
•	Status is never conveyed by color alone (form validation, submission success) — always paired with an icon or text label.
Screen-specific:
Screen	Key interaction	System response	Edge case handling
Sign Up	Submit form	Creates Supabase Auth user + profile row; routes to Care Recipient List	Invalid email / weak password / missing field → inline error, no account created
Log In	Submit credentials	Authenticates via Supabase Auth; routes to Care Recipient List	Invalid credentials → inline error naming the problem generically (“email or password incorrect”) without confirming which one, for basic account-enumeration hygiene; no password-recovery link this Beta (§2.5 note)
Add Care Recipient	Submit form	Inserts care_recipients row; returns to list	Missing name → inline error; blank care_notes allowed (BR-004)
Bundle Selection	Tap a bundle card	Highlights selection, enables Continue	Full Circle / Peace of Mind are not rendered at all — not shown greyed-out or disabled, matching §3.5; no pricing figures rendered anywhere on this screen (BR-005)
Date/Time Selection	Tap an available slot	Highlights selection, enables Continue	A slot can become unavailable before submit (no locking exists) — copy must not imply the slot is held or reserved during selection
Booking Review	Tap Submit	Loading state → success routes to Confirmation	Connection loss/error → retry option, data retained in memory; re-tapping while the first attempt is still in flight does not create a second booking
Leave Without Finishing (modal)	FM taps Back/Cancel/navigates away, Bundle Selection onward	Modal: “Leave without finishing? Your progress won’t be saved.” with Stay/Leave options	Confirming Leave discards all in-progress selections; no data is persisted (FR-008)
Booking Confirmation	—	Displays booking summary + “we’ll confirm your caregiver soon”	—
Admin Booking Queue	View only, within this feature	Lists bookings where status = requested	Empty state: “No new requests.” No assignment action here — that’s FD-VERIFY
Trust/transparency note (care sensitivity — company-facts §7 principle: clear communication, appropriate human oversight): the Add Care Recipient screen should carry short microcopy near the care_notes field disclosing that this information will be visible to Admin and to the caregiver assigned to this recipient’s booking, per the founder’s full-visibility decision (Decision_Log.md, 2026-08-28). Stating this upfront, before the FM types anything sensitive, is more trustworthy than leaving it implicit — and costs nothing to build.
6.6 Open items surfaced by this section
Needing input or confirmation before high-fidelity Figma work is finalized. Lettered for reference (e.g. “FD-ACC §6.6(a)”):
(a)	RESOLVED 2026-08-28 — Bundle content found in COMPANY-FACTS.md §9 (previously not located in any doc reviewed). MediCheck Plan: 3-hour daily visit; medication administration, vitals check (BP/glucose), companionship; SLA — emergency response <30 min, missed-meds alert <15 min; daily “MediCheck Report” in-app; 12,000–15,000/month. Doctor’s Day Out: 4–5 hr, day-of-appointment; pre-visit prep, transport & escort, advocacy/note-taking, post-visit report; SLA — emergency response <15 min, dedicated hotline; “Clinic Visit Report” in-app; 2,500–4,000/visit. Bundle Selection and Date/Time Selection screens can now be built to final content.
(b)	RESOLVED 2026-08-28 — care_notes is optional (Peter, see Decision_Log.md; BR-004, AC-004).
(c)	RESOLVED 2026-08-28 — Log In confirmed in scope as a baseline of account creation (Peter/founder, see Decision_Log.md; FR-007, AC-005).
(d)	RESOLVED 2026-08-28 — “Leave without finishing? Your progress won’t be saved” prompt, Bundle Selection onward, approved by Peter as P0 (FR-008, AC-006). Lightweight and non-persistent — complements the P2 save-drafts backlog item in Product_Backlog.md rather than replacing it; makes data loss visible to the FM instead of silent.
(e)	RESOLVED 2026-08-28 — Bundle pricing (12,000–15,000/month for MediCheck; 2,500–4,000/visit for Doctor’s Day Out, per §6.6(a)) will NOT be displayed on the Bundle Selection screen or anywhere else in Beta. Founder decision; consistent with pricing/business model still being WORKING, not approved (company-facts §11). See BR-005.
07. Technical Specification — David, 2026-08-28 (decisions confirmed by founder and Tech Lead same day — see Decision_Log.md)
Scope note: this spec covers only what FD-ACC needs to build (account creation → care recipient → bundle selection → booking request, ending in status = “requested”). It defines the bookings table’s full shape now — including fields FD-ACC doesn’t populate — so FD-VERIFY and FD-VISIT don’t force a schema rework later, per MVP_Beta_Delivery_Plan.md §5 (FD-ACC and FD-VERIFY are built in parallel and share this table).
7.1 Technical architecture reference
CONFIRMED (Tech Lead, 2026-08-28): Supabase Postgres as primary datastore, Supabase Auth for identity, and Supabase’s auto-generated REST (PostgREST) as the main API layer, consumed directly by the client with Row-Level Security (RLS) enforcing access — the standard Supabase pattern, and the simplest option consistent with the “avoid unnecessary technical complexity” principle (company-facts §18.6). No longer an assumption.
CONFIRMED (Tech Lead, 2026-08-28): frontend is a Next.js (React) web app, greenfield (no existing codebase), served at vizazicare.com. One product serves Admin, Caregiver, and Family Member with role-based (RBAC) views, built and deployed as one repo (a second repo holds backend/Supabase config) — repo structure was initially ambiguous between two Tech Lead answers, resolved by the founder 2026-08-28 in favor of the combined-app/single-repo reading. Environment topology and CI/CD flow are also confirmed — see Technical_Architecture_Reference.md.
Full detail now lives in the shared Technical_Architecture_Reference.md (new, 2026-08-28) rather than being restated per-document — that file is the source of truth for stack components going forward; the other four Feature Dev docs’ §7.1 should point to it too once David completes their §7 sections.
7.2 Database — tables/entities required
Table	Key columns	Notes
profiles	id (uuid, PK = auth.users.id), role (enum: family_member, admin, caregiver), full_name, phone, email, created_at	Extends Supabase’s built-in auth.users with app-level role and contact info. Caregiver role exists here now because FD-VERIFY will need it, but is not populated by FD-ACC.
care_recipients	id (uuid, PK), account_id (FK → profiles.id, NOT NULL), name, care_notes (text), created_at	care_notes is the sensitive field — see §7.5. Beta ships with a single free-text notes field; a structured mandatory/optional field model and media/document attachments are logged in Product_Backlog.md as post-Beta work, not built here.
bookings	id (uuid, PK), account_id (FK → profiles.id, NOT NULL), care_recipient_id (FK → care_recipients.id, NOT NULL — enforces BR-002), bundle_code (enum: medicheck, doctors_day_out — enforces BR-001/BR-003… see BR-001 above), requested_datetime (timestamptz, NOT NULL), status (enum: requested, assigned, in_progress, completed, cancelled; default ‘requested’), assigned_caregiver_id (FK → profiles.id, NULL), created_at	FD-ACC only ever writes status=‘requested’ and leaves assigned_caregiver_id NULL. Later states/columns are populated by FD-VERIFY and FD-VISIT — included here so that work doesn’t require an ALTER TABLE mid-Beta.
CONFIRMED (2026-08-28): bundles are modeled as a fixed enum (bundle_code), not a separate editable bundles table — David’s original TECHNICAL DECISION, now confirmed (see Decision_Log.md). MVP Scope §5.6 explicitly excludes booking customization and only 2 bundles exist this Beta — a config table would be unused flexibility. If/when bundle catalog work is scoped (P2, per company-facts §8), bundle_code can be promoted to a FK against a real table without breaking existing bookings, provided the enum values become the table’s primary keys.
7.3 APIs — required endpoints/integrations
Standard Supabase pattern: reads/writes go through PostgREST directly from the client, protected by RLS (§7.4). No custom backend service is needed for FD-ACC specifically.
Operation	Mechanism	Notes
Account creation	Supabase Auth (signup)	DECIDED (founder, 2026-08-28): email/password for Beta. Phone-OTP as an additional signup option is planned for the near future — logged as a new feature in Product_Backlog.md, not built this cycle.
Add care recipient	PostgREST insert on care_recipients	RLS restricts account_id to auth.uid().
List own recipients	PostgREST select on care_recipients	RLS-scoped.
Submit booking request	PostgREST insert on bookings	BR-001 (bundle restriction) and BR-002 (recipient required) are enforced at the database level (enum type + NOT NULL FK, §7.2) rather than in a custom API layer — simpler and holds even if a client bypasses app logic. No Edge Function needed for FD-ACC.
Admin booking queue	PostgREST select on bookings where status = ‘requested’	RLS: admin role only.
7.4 Authentication & authorisation
•	Identity: Supabase Auth, email/password for Beta (§7.3). Role (family_member / admin / caregiver) stored in profiles.role, checked by RLS policies.
•	Admin accounts are provisioned manually by the Tech Lead/founder — no public admin signup route, consistent with a manually-run Beta (MVP Scope §4, Goal 5).
•	RLS policy summary:
–	Family Member: full CRUD on own care_recipients and bookings only (account_id = auth.uid()), no access to other families’ data.
–	Admin: read access to all bookings (for the queue) and full read access to care_recipients data, including care_notes (§7.5) — no write access to a Family Member’s care_recipients (Admin doesn’t edit recipient profiles — out of scope).
–	Caregiver: no access under FD-ACC (no caregiver exists in this flow yet). Once FD-VERIFY assigns a caregiver to a booking, that caregiver gets full read access to the linked care_recipient’s data, including care_notes (§7.5) — placeholder role left here so FD-VERIFY can add that policy without redesigning the table.
7.5 Security & privacy
•	DECIDED (founder, 2026-08-28): for Beta, all care_recipient data — including care_notes — is fully visible to Admin and to the Caregiver assigned to that recipient’s booking, given both pilot caregivers are fully verified before assignment (FD-VERIFY). This supersedes David’s earlier proposal to scope Admin/Caregiver access more narrowly — the founder’s simpler rule is what Beta builds against (see Decision_Log.md).
•	The founder also raised a broader topic while resolving this: the care-recipient data model itself (which fields are mandatory vs. optional for FM to provide, notes format, media/document attachments) and whether visibility should eventually be more granular than Beta’s “full visibility to Admin + Caregiver” rule. This is real product scope, not a detail to resolve inside FD-ACC’s technical spec — logged as three grouped items in Product_Backlog.md (see FD-ACC §7.5(a)/(b)/(c) references there) for Peter/Maya to scope post-Beta.
•	DEFERRED, not a Beta blocker: Kenya’s Data Protection Act 2019 likely has requirements relevant to storing this kind of personal/health-adjacent data. Founder has flagged this as a larger topic to take up later. This spec still does not assert compliance either way — not logged to Product_Backlog.md (it’s a legal/compliance review, not a product feature), but noted here so it isn’t lost. Handoff to Bella/founder when that workstream starts.
•	Standard Supabase encryption at rest/in transit is assumed sufficient at this scale (5 families) — no additional encryption layer recommended; would be over-engineering relative to MVP discipline (company-facts §18.6).
•	No payment data touches this feature (manual/offline this cycle, MVP Scope §5.5) — no PCI-relevant scope.
7.6 External services
None required for FD-ACC as scoped. GPS/Maps: explicitly out of scope (MVP Scope §5.4). M-Pesa: out of scope, payment is manual/offline this cycle (§5.5). SMS/WhatsApp: not needed — see decision below.
DECIDED (founder, 2026-08-28): ship Beta with an in-app Admin queue only — no SMS/push/WhatsApp integration (see Decision_Log.md). Revisit as P1 if Admin actually misses requests during the pilot.
7.7 Technical dependencies
•	Supabase Auth and the profiles role model must be configured before care_recipients/bookings RLS can be written — sequencing note for Week 2 Technical Discovery.
•	FD-ACC and FD-VERIFY are built in parallel (MVP_Beta_Delivery_Plan.md §5/§6) and share the bookings table. The status enum and assigned_caregiver_id column defined in §7.2 are the shared contract between the two docs — FD-VERIFY should build against this shape rather than re-deriving it, to avoid a mid-sprint migration.
•	DECIDED (founder, 2026-08-28): no locking/reservation logic for the double-booking race (closes FD-ACC §2.5 Exception 3) — a plain insert is sufficient at N=5 families/2 caregivers (see Decision_Log.md). Revisit as a P1 (optimistic locking or slot reservation) only if real double-bookings occur during the pilot.
•	Depends on the Tech Lead review-gate checkpoints being scheduled during Week 2 (per Decision_Log.md, 2026-08-28) before Weeks 4–5 development on this schema begins.
7.8 Open items surfaced by this spec
Needing a decision or confirmation before Development Tasks (§10) are finalized. Lettered for reference (e.g. “FD-ACC §7.8(a)”):
(a)	Frontend stack / existing codebase state — RESOLVED 2026-08-28: Next.js (React) web app, greenfield, one RBAC-gated product for Admin/Caregiver/FM, one repo (plus a backend-config repo), served at vizazicare.com (Tech Lead + founder, §7.1, Decision_Log.md).
(b)	Phone-OTP vs. email/password signup — RESOLVED 2026-08-28: email/password for Beta; phone-OTP logged as a future feature in Product_Backlog.md.
(c)	Admin notification channel — RESOLVED 2026-08-28: in-app queue only (§7.6, Decision_Log.md).
(d)	RLS scoping for care_notes — RESOLVED 2026-08-28 for Beta: full visibility to Admin and assigned Caregiver (§7.5, Decision_Log.md). Broader care-recipient data model/visibility topic logged in Product_Backlog.md for post-Beta.
(e)	Kenya Data Protection Act applicability — still OPEN, but explicitly DEFERRED by founder to a later, separate workstream (§7.5). Not blocking Beta. Bella/founder, no timeline set.
— End of Section 7 —
08. User Stories
US-001
As a Family Member
I want to create an account with my basic contact info
So that Vizazi Care can identify me and my bookings.
US-002
As a Family Member
I want to add a care recipient with their name and relevant care notes
So that Vizazi Care knows who the care is for.
US-003
As a Family Member
I want to see exactly two bundle options with their inclusions, frequency, and response-time SLA
So that I can choose the care that matches my recipient’s needs.
US-004
As a Family Member
I want to select a date/time relevant to my chosen bundle
So that I can request care when it’s needed.
US-005
As an Admin
I want to see new booking requests as they come in
So that I can begin the caregiver assignment process.
US-006
As a returning Family Member
I want to log in to my existing account
So that I can access my care recipients and bookings across sessions.
US-007
As a Family Member
I want a warning before I exit the booking flow without finishing
So that I know my progress won’t be saved and can decide whether to continue or leave.
09. Acceptance Criteria
AC-001 — Account creation
Given a new Family Member with no account
When they submit basic contact info
Then an account is created and they can proceed to add a care recipient.
AC-002 — Bundle restriction
Given a Family Member on the bundle selection screen
When the screen loads
Then only MediCheck and Doctor’s Day Out are shown, with no way to select Full Circle or Peace of Mind.
AC-003 — Booking visible to Admin
Given a Family Member has selected a bundle and a date/time
When they submit the booking request
Then the request is recorded and appears to Admin without further action from the Family Member.
AC-004 — Care notes are optional
Given a Family Member adding a care recipient
When they submit a name but leave care notes blank
Then the care recipient is still successfully added.
AC-005 — Returning-user login
Given a Family Member with an existing account
When they provide valid login credentials
Then they gain access to their account, including their care recipients and bookings.
AC-006 — Leave-without-finishing warning
Given a Family Member is at Bundle Selection or a later step in the booking flow
When they attempt to exit or cancel out of the flow
Then a confirmation prompt appears stating their progress won’t be saved, with the option to stay or leave; no data is persisted if they choose to leave.
10. Development Tasks — David, 2026-09-04
Sequencing note: tasks are grouped in build order (repo/infra → database → auth → UI screens → cross-cutting patterns → CI/CD). Within a group, order isn’t strict; across groups, each depends on the one before it. All tasks are built via Claude Code and pass through the Tech Lead review gate before merge (Decision_Log.md, 2026-08-28) — “Owner: David” below means David defines/reviews the task technically, not that a human named David hand-writes the code.
Repo & environment setup
ID	Development Task	Owner	Status
DEV-001	Initialize the app repo (Next.js/React, per §7.1) on GitHub	David	Not started
DEV-002	Initialize the backend-config repo (Supabase migrations/config) on GitHub	David	Not started
DEV-003	Provision the Supabase project (dev environment) and wire environment variables into the app repo	David	Not started
Database (§7.2)
ID	Development Task	Owner	Status
DEV-004	Create profiles table (extends auth.users) with role enum (family_member, admin, caregiver), full_name, phone, email	David	Not started
DEV-005	Create care_recipients table (account_id FK, name, care_notes)	David	Not started
DEV-006	Create bookings table with full column set from §7.2 (account_id, care_recipient_id NOT NULL, bundle_code enum, requested_datetime, status enum default ‘requested’, assigned_caregiver_id nullable) — built to the shared FD-VERIFY contract even though FD-ACC only writes status=‘requested’	David	Not started
DEV-007	Write RLS policies per §7.4: Family Member CRUD scoped to own care_recipients/bookings; Admin read-all on bookings + full read on care_recipients including care_notes; Caregiver placeholder policy left for FD-VERIFY to complete	David	Not started
Auth (§7.3, §7.4)
ID	Development Task	Owner	Status
DEV-008	Configure Supabase Auth for email/password signup (FR-001)	David	Not started
DEV-009	Document/set up the manual Admin account provisioning process (no public admin signup route, §7.4)	David	Not started
DEV-010	Build Sign Up screen (FR-001, AC-001) — inline validation for email/password/required fields, per §6.5 general patterns	David	Not started
DEV-011	Build Log In screen (FR-007, AC-005) — generic invalid-credentials error per §6.5, no password-recovery link (§2.5 note)	David	Not started
DEV-012	RBAC route guarding — redirect/gate views by profiles.role so Admin, Caregiver, and FM see only their own routes within the single combined app (§7.1)	David	Not started
Family Member booking flow UI (§6.1, §6.4, §6.5)
ID	Development Task	Owner	Status
DEV-013	Care Recipient List screen, incl. first-time empty state (§6.4)	David	Not started
DEV-014	Add Care Recipient screen — name required, care_notes optional (FR-002, AC-004, BR-004); include the trust/transparency microcopy from §6.5 disclosing care_notes visibility to Admin/assigned Caregiver	David	Not started
DEV-015	“Who is this booking for?” screen — conditional, shown only when 2+ recipients exist (§6.1)	David	Not started
DEV-016	Bundle Selection screen — MediCheck / Doctor’s Day Out only, content from §6.6(a), no pricing (FR-003, FR-004, AC-002, BR-005)	David	Not started
DEV-017	Date/Time Selection screen — options relevant to the chosen bundle (FR-005); copy must not imply a slot is held/reserved, since no locking exists (§7.7, §6.5)	David	Not started
DEV-018	Booking Review screen — recipient/bundle/date-time summary with per-step Edit links	David	Not started
DEV-019	Submit flow: PostgREST insert on bookings (§7.3); “Submitting…” disabled-button state to prevent double-submit; connection-loss/error retry with in-memory data retention (§6.1, §6.5)	David	Not started
DEV-020	Booking Confirmation screen (FR-006)	David	Not started
DEV-021	Leave-without-finishing modal — triggered Bundle Selection onward on back/cancel/navigate-away, non-persistent (FR-008, AC-006)	David	Not started
Admin UI
ID	Development Task	Owner	Status
DEV-022	Admin Booking Queue screen — view-only list where status=‘requested’, empty state “No new requests.” (FR-006, §7.6); no assignment action (that’s FD-VERIFY)	David	Not started
Cross-cutting
ID	Development Task	Owner	Status
DEV-023	Global error/retry and inline-validation patterns applied consistently across all screens above (§6.5 general patterns)	David	Not started
CI/CD (Technical_Architecture_Reference.md)
ID	Development Task	Owner	Status
DEV-024	Configure GitHub → Playwright pipeline: Playwright runs as the quality gate on push (confirmed 2026-09-04, no separate staging environment)	David	Not started
DEV-025	Configure Vercel production deployment, gated on Playwright passing	David	Not started
DEV-026	Wire the Tech Lead review-gate checkpoint into the PR/merge process (Decision_Log.md, 2026-08-28)	David	Not started
Out of scope for these tasks (per §7.6, §7.5, §3.5): SMS/WhatsApp integration, GPS, M-Pesa/payment, booking-slot locking, phone-OTP signup, and structured care-recipient data fields/media attachments beyond a single free-text notes field — all already logged elsewhere (Decision_Log.md, Product_Backlog.md) and intentionally not tasked here.
Quinn owns writing the actual Playwright test cases against AC-001–006 — DEV-024 above is the pipeline/harness only, not the test cases themselves. Test cases built out 2026-09-04 — see §12. One dependency DEV-024 still needs to resolve, surfaced while writing these: a test-data seeding/reset strategy for CI, since there’s no separate staging environment (§10 CI/CD note) — see §12’s note on this before DEV-024 is marked done.
11. Sprint
Sprint: Sprint 1
Dates: Weeks 4–5 of the delivery pipeline (~Sep 16–29, 2026 — derived from MVP_Beta_Delivery_Plan.md §6’s Aug 26 pipeline start; that document names sprints by week number, not calendar date, so this is Peter’s derived mapping, not a separately founder-confirmed date range)
Sprint Goal: Ship all of FD-ACC’s Development Tasks (DEV-001–026, §10) so a Family Member can create an account, add a care recipient, select a bundle, choose a date/time, and submit a booking request that’s visible to Admin — built alongside FD-VERIFY, Sprint 1’s other document (MVP_Beta_Delivery_Plan.md §4/§6).
Confirmed against §10: all 26 tasks belong to Sprint 1 — FD-ACC doesn’t span multiple sprints (unlike the general case the template anticipates in “a feature can span several sprints”), so a separate Task | Sprint | Status mapping table would just duplicate §10’s own ID/Status columns with no new information. Per-task status is tracked directly in §10 as development proceeds; that table is the single source of truth for task-level status, not a copy here.
12. Testing — Quinn, 2026-09-04
Scope: scripted test cases against AC-001–006, written to run as Playwright specs through DEV-024’s GitHub → Playwright pipeline (the quality gate on every push, per §10 — there is no separate staging environment, so these are the gate between a push and Vercel deploy, §DEV-025). Success Metrics reference: MVP_Scope_Beta_Pilot_Launch.md §11 (Adoption — all 5 families complete at least one full cycle) sits downstream of this flow working correctly; these test cases are what gives confidence the cycle itself doesn’t break, not a direct test of the adoption metric.
Prioritization logic (risk-based, per company-facts §18.6 MVP discipline — this is the entire critical path for Beta, so nothing here is “nice to have,” but within that, priority reflects what would fail silently or block every family vs. what has a workaround): P0 = blocks core flow or fails silently if broken (a lost booking, a duplicate booking, a bundle rule bypassed); P1 = matters but has a visible symptom and/or a narrow trigger condition.
12.1 Test cases
Test ID	Maps to	Priority	Precondition	Steps	Expected Result
TC-ACC-001	AC-001 (happy path)	P0	FM has no account	1. Go to Sign Up. 2. Enter valid full name, email, phone, password. 3. Submit.	Account created (auth.users + profiles row); FM routed to Care Recipient List, first-time empty state.
TC-ACC-002	AC-001 (negative)	P0	FM has no account	1. Go to Sign Up. 2. Enter an invalid email format. 3. Submit.	Inline error on the email field; no account created; FM stays on Sign Up.
TC-ACC-003	AC-001 (negative)	P1	FM has no account	1. Go to Sign Up. 2. Leave a required field blank (e.g. full name). 3. Submit.	Inline error on the blank field; no account created.
TC-ACC-004	AC-002 (happy path)	P0	FM logged in, ≥1 care recipient exists	1. Proceed to Bundle Selection.	Exactly two cards render — MediCheck, Doctor’s Day Out — each showing inclusions/frequency/SLA and no price. Full Circle and Peace of Mind are not rendered anywhere on the screen (not greyed-out, not present).
TC-ACC-005	AC-002 (negative, API-level)	P0	Authenticated FM session (valid JWT), bypassing the UI	1. Send a direct PostgREST insert to bookings with bundle_code set to a value outside the enum (e.g. “full_circle”).	Insert rejected at the database level (enum constraint violation); no booking row created. Confirms BR-001 holds even if a client bypasses the UI — this is the one AC-002 case Playwright must exercise below the UI, since the enum is the actual enforcement point (§7.3), not the screen.
TC-ACC-006	AC-003 (happy path)	P0	FM has selected a bundle and date/time, on Booking Review	1. Tap Submit.	Booking row inserted with status=‘requested’; FM sees “Submitting…” disabled-button state, then Booking Confirmation; the same booking appears in Admin Booking Queue with no Admin action taken.
TC-ACC-007	AC-003 (edge — double-submit)	P0	FM on Booking Review	1. Tap Submit, then immediately tap it again (or simulate a slow response and tap again before it returns).	Exactly one booking row is created; the button disables after the first tap so the second tap has no effect. Called out in §6.5 as the only real safeguard against a duplicate booking, since no slot-locking exists.
TC-ACC-008	AC-004 (happy path)	P0	FM adding a care recipient	1. Enter a name. 2. Leave care notes blank. 3. Submit.	care_recipients row created with care_notes null/empty; FM returned to Care Recipient List showing the new recipient.
TC-ACC-009	AC-004 (negative, inverse)	P1	FM adding a care recipient	1. Leave name blank (optionally fill care notes). 2. Submit.	Inline error on the name field; no care_recipients row created (BR-004).
TC-ACC-010	AC-005 (happy path)	P0	FM has an existing account, logged out	1. Go to Log In. 2. Enter valid email + password. 3. Submit.	FM authenticated, routed to Care Recipient List showing their existing recipients and bookings.
TC-ACC-011	AC-005 (negative)	P1	FM has an existing account, logged out	1. Log In with a valid email + wrong password. 2. Separately, Log In with a non-existent email.	Both cases return the identical generic error (“email or password incorrect”) — must not be distinguishable, per §6.5 account-enumeration hygiene. No access granted in either case.
TC-ACC-012	AC-006 (happy path)	P0	FM at Bundle Selection or later, with unsaved selections	1. Tap Back/Cancel/navigate away. 2a. Tap Leave. 2b. (separate run) Tap Stay.	Modal “Leave without finishing? Your progress won’t be saved” appears with Stay/Leave. Leave → selections discarded, nothing persisted, FM exits the flow. Stay → modal dismisses, FM remains on the same step with selections intact.
TC-ACC-013	AC-006 (boundary)	P1	FM before Bundle Selection (Sign Up, Care Recipient List, or Add Care Recipient)	1. Tap Back/Cancel/navigate away.	No leave-without-finishing modal appears — FR-008/AC-006 scope is “Bundle Selection onward” only; earlier steps exit normally.
TC-ACC-014	Cross-cutting (AC-003 reliability, NFR §4.2)	P0	FM on Booking Review, Submit tapped	1. Simulate connection loss or a server error immediately after Submit.	“Couldn’t submit — check your connection and try again” shown; previously entered recipient/bundle/date-time selections remain in memory; Retry re-enables the button and, on success, creates exactly one booking (not zero, not two).
Actual Result / Pass-Fail / Bug ID are not pre-filled here — they’re populated per-run in the Playwright pipeline’s own output (DEV-024), not authored in this doc. This table is the spec each Playwright test is written against; TEST ID here should match the Playwright test name 1:1 so a failing CI run maps back to this table without translation.
12.2 Open dependency surfaced while writing these (flagging for David, not resolving here)
None of TC-ACC-001–014 specify how test data is isolated or reset between CI runs. Since DEV-024 confirms no separate staging environment, these presumably run against a dev/test Supabase project on every push — but without a seeding/reset strategy, tests that create accounts, care recipients, and bookings (nearly all of them) will either collide with leftover data from prior runs or need each test to generate unique data (e.g. randomized emails) and clean up after itself. This isn’t decided anywhere in §7 or §10. Recommend David resolve it as part of DEV-024 before that task is marked done — otherwise the pipeline will be flaky in a way that looks like product bugs.
12.3 What this section does not cover
Real-device/field testing, exploratory testing, and UAT with actual pilot families are not scripted here — per the qa-testing-strategy approach, those are better run time-boxed and observationally once a build exists to put in front of someone, not pre-scripted. Recommend a short UAT pass (goal: “create an account and book a MediCheck visit for your relative,” not a step-by-step script) once DEV-001–024 are merged and before Release (§13), watching for hesitation points rather than just pass/fail. Not yet scheduled — flagging for Peter/founder to slot into the Sprint 1 → Release window.
12.4 Exit criteria for this feature
All P0 test cases (TC-ACC-001, 002, 004–008, 010, 012, 014) pass. Zero known data-loss or duplicate-booking bugs. The AC-002 enum-enforcement case (TC-ACC-005) passes specifically — a UI-only pass here would be a false confidence signal, since the UI restriction alone doesn’t prove BR-001 holds. P1 cases failing at the merge point is a “known issue with a tracked follow-up” decision for Peter, not an automatic blocker — but should be a deliberate call, not silence.
13. Release
Per delivery plan §6, target Oct 7–10, 2026.
14. Product Performance & Learning
Post-release, tied to MVP Scope §11 Adoption metrics.
15. Decision Log
Founder-, Peter-, and Tech Lead-confirmed decisions from this feature are logged in Decision_Log.md (2026-08-28): in-app-only Admin notifications, no booking-slot locking for Beta, email/password signup for Beta, full care-recipient data visibility for Admin/Caregiver for Beta, care-recipient name required/notes optional, Log In confirmed as implied baseline scope, self-service password recovery excluded from Beta (moved to Product_Backlog.md), the founder’s redesign-from-scratch decision for §6 UX/Design, the leave-without-finishing warning (FR-008/AC-006) approved by Peter, no bundle pricing shown in Beta (BR-005), backend architecture stack confirmed by the Tech Lead (§7.1, new Technical_Architecture_Reference.md), bundle-as-fixed-enum modeling confirmed (§7.2), frontend framework/repo structure/deployment/environment topology/CI-CD confirmed by the Tech Lead and founder (§7.1), and Playwright confirmed as the quality gate with no separate staging environment (2026-09-04).
