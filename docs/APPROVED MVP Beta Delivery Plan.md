APPROVED MVP Beta Delivery Plan
Vizazi Care — MVP Beta Delivery Plan Prepared by: Peter (Product Manager) Date: 2026-08-28 (rev. 3 — timeline resolved, template decisions folded in) Status: PROPOSED — pipeline plan; open items are listed in §9, none currently blocking
1. Timeline — resolved
Target release: Oct 7–10, 2026. Contingency buffer: up to 3 weeks (through ~Oct 31, 2026), reserved specifically for uncontrollable external delays — developer/environment setup delays, or pilot caregiver availability. This is a defined fallback window, not an informal extension of the build phase. The earlier-cited "Re-Calibrated Strategic Roadmap" (which put Beta Launch in November) is not being added to the project and is not tracked as a separate source of truth going forward — this document and MVP_Scope_Beta_Pilot_Launch.md are authoritative on timing.
MVP_Scope_Beta_Pilot_Launch.md has been updated to match: title, MVP Name, and Timeline (§13) no longer reference November; §13 now shows Oct 7–10 as the launch target with the 3-week contingency explicit.
2. Scope status
MVP_Scope_Beta_Pilot_Launch.md is the scope source of truth (Hypothesis, Goals, Success Metrics, Risks, Dependencies, Open Questions, MVP Boundary). Founder has confirmed:
•	The 11 P0 features / 4 epics are the locked MVP Beta scope for this cycle — no new P0 additions once Week 1 closes.
•	Bella's SLA/pricing validation check is not required this cycle — removed from Week 1.
•	Dev capacity is confirmed via Claude Code.
•	The human review gate for Claude-Code-built work is owned by a Tech Lead (a human role, outside the six-person AI project team) — not something David needs to define himself, but David should coordinate technical review checkpoints with that Tech Lead during Week 2 technical discovery, so the gate exists before Weeks 4–5 development starts, not discovered mid-sprint.
3. Scope for this Beta (P0 only) — unchanged
Account & Booking: Account + recipient creation [P0-1], Bundle selection [P0-2], Time slot + booking [P0-3]. Caregiver Verification & Assignment: Verification [P0-4], Manual assignment [P0-5], Verification visibility [P0-6]. Visit Execution & Task Checklist: Checklist per visit [P0-7], Manual check-in/out [P0-8], Task completion + mandatory-task enforcement [P0-9]. Family Visibility & Admin Oversight: Family visibility [P0-10], Admin exception monitoring [P0-11]. Deferred: Booking customization, automated matching, automated checklist engine, GPS verification, richer analytics, in-app ratings (all P1); Payments (P1); Future Bundles/tiers/categories/geo (P2).
4. Feature Dev Template — grouping decision
Founder approved grouping the 11 P0 features into ~5–6 Feature Dev Template documents instead of 11 one-per-row. This grouping happens now, at the start of Week 1, before Feature Definition drafting begins — it determines document count and sets the Document IDs everything else references. Proposed grouping, by shared user flow/screen:
•	FD-ACC — Account & Booking Flow: P0-1, P0-2, P0-3 (one continuous Family Member journey)
•	FD-VERIFY — Caregiver Verification & Assignment: P0-4, P0-5, P0-6 (one Admin-driven flow with an FM-facing output)
•	FD-VISIT — Visit Execution & Task Checklist: P0-7, P0-8, P0-9 (same visit screen, same caregiver flow)
•	FD-FAMVIS — Family Visibility: P0-10 (distinct persona/screen from Admin oversight)
•	FD-ADMINEXC — Admin Exception Monitoring: P0-11 (distinct persona/screen from family visibility)
5 documents. Document IDs use the P0 feature IDs directly for this Beta's instances rather than a separate numbering scheme.
5. Dependency sequencing (critical path) — unchanged
P0-4 blocks P0-5 → P0-1/2/3 also feed P0-5 → P0-2 drives P0-7 → P0-5 + P0-7 feed P0-8/P0-9 → P0-8/P0-9 produce the data P0-10 and P0-11 surface.
Build order: FD-ACC + FD-VERIFY in parallel first → FD-VISIT → FD-FAMVIS + FD-ADMINEXC last.
6. Pipeline (Aug 26 – Oct 10, contingency through ~Oct 31)
Week 1 — Requirements & Kickoff: Peter confirms the 5-document grouping, drafts sections 1–5 (Business Need → Feature Spec) for all 5 docs; scope doc Open Questions get closed (David: verification data fields, checklist-screen decision jointly with Peter; Maya: badge treatment; Peter+founder: 15-min threshold; founder: escalation process, Goal 5 metric-or-constraint). Output hands to Maya and David.
Week 2 — UX/UI Design + Technical Discovery (parallel): Maya builds wireframes/flows for all 5 documents, badge treatment, service-safety review. David runs technical discovery against Supabase/codebase, verification data model, checklist-screen implementation, technical spec outline, and coordinates Tech Lead review-gate checkpoints for Weeks 4–5. Peter syncs mid-week.
Week 3 — Design & Technical Spec finalization: Maya finalizes high-fidelity screens/prototype for founder review. David finalizes technical specification per document. Peter finalizes user stories + acceptance criteria (sections 8–9). Quinn begins test strategy/cases built directly off §11 Success Metrics.
Weeks 4–5 — Development, 2 sprints: David builds in dependency order (Sprint 1: FD-ACC + FD-VERIFY; Sprint 2: FD-VISIT + FD-FAMVIS + FD-ADMINEXC) via Claude Code, with the Tech Lead review gate applying throughout. Quinn tests feature-by-feature as work lands. Peter runs sprint reviews and guards scope against P1 creep.
Week 6 — QA, UAT, Release Readiness: Quinn runs full E2E pass against §11 Success Metrics, UAT with founder + the 2 pilot caregivers, and issues RELEASE READINESS: READY/NOT READY. Peter + Nia synthesize go/no-go for founder. Buffer for fixes.
Release window Oct 7–10, 2026 (contingency through ~Oct 31 if needed): David deploys; Peter confirms instrumentation is live against §11 Success Metrics and opens the iteration/decision log for pilot learnings feeding Goal 4.
7. Templates — status
•	MVP Scope: done — MVP_Scope_Beta_Pilot_Launch.md, in project.
•	Feature Dev Template (Business Need → Decision Log, per feature-group): done — Feature_Dev_Template.md, finalized this cycle, in project.
•	Decision Log: company-wide log maintained by Nia; company-facts §15 reinstates it as an explicit pipeline step; Feature Dev Template §15 links into it rather than duplicating.
8. Risks — updated
•	Escalation process for Admin exceptions is still undefined (scope doc Risk #5) — needs founder input in Week 1, not discovered in Week 6.
•	Scope doc Assumptions #1 (verification moves trust, not price/brand) and #4 (both caregivers can reliably deliver both bundles) carry real weight and aren't testable until the pilot runs.
•	Tech Lead review-gate timing: David needs to confirm checkpoints with the Tech Lead in Week 2, before Weeks 4–5 development starts — otherwise the gate risks becoming a Week 4 surprise rather than a planned checkpoint.
9. Decisions required (founder) — remaining
1.	Close the four founder-owned Open Questions in MVP_Scope_Beta_Pilot_Launch.md §14: 15-minute check-in threshold, escalation process, Goal 5 metric-or-constraint, and (jointly with David/Peter) the checklist-screen decision.
2.	~~Confirm the 5-document Feature Dev Template grouping~~ — Confirmed 2026-08-28. Week 1 drafting is underway against this grouping.
Next handoff
David — verification data fields, checklist-screen decision (joint with Peter), and Tech Lead review-gate coordination. Maya — verification badge treatment. Both start Week 1 items in parallel with Peter's Feature Dev drafting.

