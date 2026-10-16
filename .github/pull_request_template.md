## Linear task

<!-- e.g. DEV-024 (VIZ-28) -->

## What changed and why

## Evidence

- [ ] CI `test` job is green (link the run)
- [ ] Checked in the running app where the change is visible (screenshot or note)
- [ ] No secrets, service-role keys or personal data committed

## Risk areas touched

- [ ] Auth, RBAC or RLS (`middleware.ts`, migrations, policies)
- [ ] Database migration (note the order and any reverse step)
- [ ] Environment variables or deploy config
- [ ] None of the above

## Tech Lead review

This work is built via Claude Code and needs the Tech Lead's approval before merge (FD-ACC section 10; Decision_Log 2026-08-28).

Tech Lead checklist:

- [ ] Acceptance criteria for the Linear task are met
- [ ] Access rules (RBAC and RLS) are unchanged, or the change was reviewed
- [ ] Tests cover the behavior, not just the happy path
