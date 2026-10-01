Vizazi Care — MVP Scope (Beta Pilot Launch)
Status: WORKING / PROPOSED — pending founder approval. Once approved, the P0 requirements below should replace the "working candidate journey" language in company-facts.md §13, and this document's status line should be updated to APPROVED per company-facts §22.
Owner: Founder (drafted with Peter via Cowork write-spec; retrofitted into the MVP Scope Template's Full structure) Last updated: 2026-08-28
Revision note (2026-08-28): Target release window confirmed as Oct 7–10, 2026, with a 3-week contingency buffer (through ~Oct 31) reserved for uncontrollable external delays (developer/environment setup delays, caregiver availability). This supersedes the November 2026 date previously cited from the "Re-Calibrated Strategic Roadmap" — that roadmap document itself has not been added to the project and is not being tracked as a separate source of truth; this document and company-facts.md are authoritative on timing going forward.
1. MVP Name
Vizazi Care MVP — Beta Pilot Launch (MediCheck + Doctor's Day Out Bundle, 5 families / 2 caregivers)
2. Problem Statement
Families arranging home-based elder care in Nairobi currently rely on informal networks with no reliable way to verify caregiver trustworthiness, confirm that scheduled care was actually delivered, or see what happened during a visit. This creates real risk and anxiety for families who often live at a distance from the elder receiving care, and makes it hard for caregivers to demonstrate the professionalism of the care they provide. Vizazi Care's MVP tests whether a structured digital platform — starting with verified caregivers, a defined task checklist per visit, and visibility for the family — can replace that uncertainty with confidence, validated through a Beta Pilot of 5 families and 2 caregivers targeted for early October 2026.
3. MVP Hypothesis
We believe that giving families visible caregiver verification, a defined per-visit task checklist, and visit-level visibility will increase their trust and confidence in home-based elder care, compared to the informal, unverified arrangements they use today. We'll know we're right when families complete the full booking → verified-assignment → visit → update cycle without reverting to informal channels, a majority return for a second booking, and end-of-pilot conversations confirm that verification specifically — not just the app's existence — is what moved their trust.
4. Goals
1.	Validate that the core loop — booking → verified-caregiver assignment → task checklist → visit → family visibility — works end-to-end for real families and caregivers.
2.	Test whether visible caregiver verification increases family trust
3.	Confirm caregivers will actually use the app to log tasks and check in/out, rather than reverting to informal methods (WhatsApp, phone calls).
4.	Generate qualitative evidence from all 5 families and both caregivers to inform whether to expand beyond MediCheck and Doctor's Day Out.
5.	Keep the pilot operationally simple enough for Admin to run manually wherever automation isn't yet justified by volume.
(Each goal traces to a metric in §11: Goal 1 → Adoption metrics; Goal 2 → Return intent + Qualitative; Goal 3 → Task integrity; Goal 4 → Qualitative; Goal 5 → implicit constraint on all P0 scope, not a directly measured metric — flagging this last one as a gap: see Open Questions.)
5. Not in Scope
1.	Full Circle and Peace of Mind bundles. Not a scope choice — a capacity fact. The 2 pilot caregivers aren't yet equipped or verified to deliver them.
2.	Automated caregiver-to-booking matching. Unnecessary complexity at 2 caregivers; Admin assigns manually.
3.	Automated task-checklist generation engine. The same two fixed checklists (MediCheck, Doctor's Day Out) can be applied by Admin by hand for a handful of bookings. Building the generation logic now is premature, before the bundle model itself has been validated.
4.	GPS-precise check-in/out. Proving location precision isn't necessary to test the core value proposition at this scale; simple manual check-in suffices.
5.	In-app payment (M-Pesa/card). Business model and pricing are still WORKING per company-facts §11. Payment can be handled manually/offline for 5 families during the pilot.
6.	Booking customization / one-off add-on tasks. Adds complexity without being necessary to test the core loop.
6. Target Users
Full definitions live in company-facts.md §6 — summarized here for context only:
•	Family Member — books and monitors care for a relative; needs confidence care is happening as promised.
•	Caregiver — delivers care against a defined checklist; needs a system that fits how they actually work.
•	Admin — manually verifies caregivers, assigns bookings, and applies checklists during this pilot.
7. Core User Journey —
Family Member:
1.	Creates an account and adds care recipient's basic details.
2.	Chooses between MediCheck and Doctor's Day Out, seeing inclusions, frequency, and response-time SLA before committing.
3.	Selects a date/time relevant to the chosen bundle; booking request is recorded.
4.	Sees a verification badge/status for the assigned caregiver before the visit.
5.	After the visit, sees which tasks were completed and any notes logged.
Caregiver:
1.	Completes verification (ID check + Admin review) before any assignment.
2.	Receives assignment and sees the exact checklist of tasks for the visit.
3.	Checks in at visit start, logs each checklist task as complete during the visit.
4.	Is blocked from closing the visit while mandatory tasks are unlogged.
5.	Checks out at visit end.
Admin:
1.	Manually reviews and verifies each caregiver before first assignment.
2.	Manually assigns one of the two verified caregivers to each booking.
3.	Monitors for exceptions (missed check-ins, incomplete visits) and intervenes.
8. MVP Epics & Features
Epic	Feature	Priority	Acceptance Criteria
Account & Booking	Family account creation + add care recipient [P0-1]	P0	FM can create an account with basic contact info; FM can add a care recipient with name and relevant care notes
Account & Booking	Bundle selection — MediCheck and Doctor's Day Out only [P0-2]	P0	FM sees exactly two bundle options with inclusions, frequency, and response-time SLA; Full Circle and Peace of Mind are not selectable
Account & Booking	Time slot selection + booking request [P0-3]	P0	FM selects a date/time relevant to the chosen bundle; booking request is recorded and visible to Admin
Account & Booking	Booking customization / one-off add-on tasks	P1	Not yet defined — deferred fast-follow, out of scope for this Beta (see §5.6)
Caregiver Verification & Assignment	Caregiver verification, Admin-side [P0-4]	P0	Both pilot caregivers complete ID check + manual Admin review before first assignment; a caregiver cannot be assigned until marked verified
Caregiver Verification & Assignment	Manual caregiver assignment [P0-5]	P0	Admin manually assigns one of the 2 verified caregivers to each booking
Caregiver Verification & Assignment	Verification visibility for Family Member [P0-6]	P0	FM sees a verification badge/status for their assigned caregiver
Caregiver Verification & Assignment	Automated caregiver-skill matching for bookings	P1	Not yet defined — deferred fast-follow
Visit Execution & Task Checklist	Task checklist per visit, manually applied by Admin [P0-7]	P0	Each booking has the correct fixed checklist attached — MediCheck or Doctor's Day Out — based on the bundle
Visit Execution & Task Checklist	Manual check-in / check-out [P0-8]	P0	Caregiver can mark check-in and check-out with a timestamp; no GPS verification required
Visit Execution & Task Checklist	Task completion + mandatory-task enforcement [P0-9]	P0	Caregiver logs each checklist task as complete during the visit; caregiver cannot close the visit while mandatory tasks are unlogged
Visit Execution & Task Checklist	Automated task-checklist generation engine (bundle → checklist logic in code)	P1	Not yet defined — deferred fast-follow
Visit Execution & Task Checklist	GPS-verified check-in/out	P1	Not yet defined — deferred fast-follow
Family Visibility & Admin Oversight	Family visibility [P0-10]	P0	FM receives visit updates showing which tasks were completed and any notes logged
Family Visibility & Admin Oversight	Admin exception monitoring, lightweight [P0-11]	P0	Admin can see, at a glance, any visit that is late, incomplete, or flagged
Family Visibility & Admin Oversight	Richer Admin analytics/dashboards	P1	Not yet defined — deferred fast-follow
Family Visibility & Admin Oversight	Ratings / structured feedback collection in-app	P1	Not yet defined — deferred fast-follow
Payments	In-app payment (M-Pesa/card)	P1	Not yet defined — deferred fast-follow (see §5.5)
Future Bundles	Full Circle and Peace of Mind bundles	P2	Explicitly future — see §5.1
Future Bundles	Progressive caregiver skill tiers / micro-certification	P2	Explicitly future — company-facts §10 marks this strategy as still under development
Future Bundles	Multiple service categories beyond Elderly Support	P2	Explicitly future
Future Bundles	Geographic expansion features	P2	Explicitly future
9. Assumptions
1.	Visible caregiver verification is the primary lever moving family trust — not price, brand, or word-of-mouth reputation. (underlies Goal 2 and the Hypothesis in §3)
2.	Fully manual Admin processes (verification, assignment, checklist application, exception monitoring) will hold up operationally at N=2 caregivers / 5 families without meaningfully delaying bookings or visits.
3.	Families and caregivers will accept offline/manual payment handling for the duration of the pilot without it undermining trust or adoption.
4.	The 2 pilot caregivers are, in practice, capable of reliably delivering both MediCheck and Doctor's Day Out as scoped (not just nominally qualified).
5.	15 minutes is an appropriate "on-time" check-in threshold across both bundle types. (also listed as an Open Question — flagged here because Success Metrics in §11 depend on it)
10. Dependencies —Caregiver verification data model and fields — David (see Open Questions).
1.	Decision on whether the manual checklist-application step (Epic: Visit Execution & Task Checklist) is a real Admin-facing screen or handled off-platform for this Beta — David, Peter.
2.	Verification badge visual treatment (text label vs. icon/badge) — Maya.
3.	Defined escalation process for Admin-flagged exceptions (who's contacted, response SLA) — founder input needed; currently undefined, which Success Metrics in §11 assume exists.
4.	Human review gate for development work built via Claude Code — owned by the Tech Lead (human role, outside the AI project team), coordinating with David on checkpoints. See MVP_Beta_Delivery_Plan.md.
11. Success Metrics
At N=5 families / 2 caregivers, percentage-based targets are misleading — a single event swings them sharply. Metrics below are binary or count-based wherever possible.
Reliability (→ Goal 1)
•	Zero missed visits with no notice (tracked as a named list, not a rate)
•	On-time check-in within 15 minutes for every visit
Task integrity (→ Goal 3)
•	Zero visits closed with mandatory tasks unlogged (a system-integrity check, not an aspirational target)
•	Both caregivers verified before their first assignment (binary)
Adoption (→ Goal 1)
•	Zero visits handled entirely outside the app
•	All 5 families complete at least one full booking → visit → update cycle
Return intent (→ Goal 2)
•	At least 3 of 5 families book a second visit within the pilot window
Qualitative (→ Goals 2, 4)
•	Structured end-of-pilot conversation with all 5 families and both caregivers, specifically asking whether visible caregiver verification increased their trust
Explicitly not measured in this Beta, and why
•	Revenue, CAC, LTV — payment is P1/manual, these numbers are meaningless before a real pricing model is live
•	Caregiver acceptance/retention rate — with 2 people, tracked as binary ("did both stay through the pilot") rather than a percentage
12. Risks .
1.	Family trust doesn't move on verification alone (relates to Assumption #1) — the pilot would validate the operational loop but fail to confirm the core differentiation bet.
2.	Manual Admin workload becomes a bottleneck even at this small scale (relates to Assumption #2) — would surface as late assignments or delayed exception handling, directly hurting the Reliability metrics in §11.
3.	Offline payment friction discourages a second booking (relates to Assumption #3) — would understate true Return Intent, or conflate a payment problem with a trust problem in the pilot's read.
4.	One or both caregivers can't consistently deliver both bundles in practice (relates to Assumption #4) — would show up as Task Integrity failures that look like a product problem but are actually a staffing/capability problem.
5.	No defined escalation process (Dependency #4) means a real exception during the pilot has no clear response path — reputational risk with a live family, independent of anything the product does correctly.
13. Timeline
•	Aug 2026 — Phase 1: Alignment (in progress) — finalize this spec, environment setup, feature-spec frameworks
•	Aug 26 – Oct 6, 2026 — Phase 2: Execution — build against the P0 list above (Figma flows, backend, UAT)
•	Oct 7–10, 2026 — Phase 3: Beta Launch (target) — live pilot: 5 families, 2 caregivers, MediCheck + Doctor's Day Out only
•	Contingency buffer — up to 3 weeks (through ~Oct 31, 2026), reserved specifically for uncontrollable external delays: developer/environment setup delays, or pilot caregiver availability delays. This is a defined fallback, not a soft cushion to informally extend Phase 2.
•	Nov–Dec 2026 — Phase 4: Scaling — demos / VC showcase, informed by pilot results
14. Open Questions
•	What exact data fields does the caregiver verification record need? — David
•	Is the manual checklist-application step a simple real screen Admin uses, or literally off-platform for this Beta? — David, Peter
•	Should the verification badge be a text label or a visual badge/icon? — Maya
•	Is 15 minutes the right "on-time" check-in threshold, or should it vary by bundle? — Peter, founder confirmation needed
•	Is there a defined escalation process when Admin sees an exception — who gets contacted, what's the response SLA? — operational decision, founder input needed
•	Does Goal 5 ("keep the pilot operationally simple") need its own explicit success metric, or does it stay an implicit constraint on scope? — flagged during this retrofit, founder confirmation needed
15. MVP Boundary — Final Approved Definition
In: Family account + care-recipient profile; booking for MediCheck or Doctor's Day Out only; manual Admin-driven caregiver verification and assignment; verification visibility for families; fixed per-bundle task checklist, manually applied; manual check-in/check-out with mandatory-task enforcement; family visibility into completed tasks/notes; lightweight Admin exception monitoring.
Out: Full Circle and Peace of Mind bundles; automated matching; automated checklist generation; GPS-precise check-in; in-app payment; booking customization/add-ons; skill-tier certification; any category beyond Elderly Support; geographic expansion.
Scale: 5 families, 2 caregivers. Target launch Oct 7–10, 2026 (contingency through ~Oct 31, 2026).

