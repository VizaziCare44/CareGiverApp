// The registry of seed modules. One place: `npm run seed` (scripts/seed.mjs) and the
// `e2e:fresh` wrapper (scripts/e2e-fresh.mjs) both read it.
//
//   accounts      the starter set: 9 accounts, 5 care recipients, 8 bookings (all requested, except B8, which is cancelled).
//                 On its own it is the empty state "caregivers exist and none is Verified".
//   admin         admin1 alone: no caregivers, no families, no bookings. The empty state
//                 "no caregivers yet" (TC-VER-063). Not part of the default run.
//   verification  (DEV-051) the caregivers' Verified history and the assigned, in progress
//                 and completed bookings, on top of `accounts`. Needs `accounts` first.
//   visit         (DEV-070) the visit of B6 (MediCheck, open, cg2, partly logged) and of B7 (MediCheck, closed, cg1, fully
//                 logged): the visit row, the checklist snapshot and the entries. Needs `accounts` and
//                 `verification` first, and migration 0020 (the visit tables of FD-VISIT 7.2).
//
// MODULES is every module there is, in the order they should run when several are asked
// for; DEFAULT_MODULES is what a plain `npm run e2e:fresh` runs: the full set, with the
// verification rows. `admin` stays out of it, because it is the same admin1 `accounts`
// already makes, kept for the runs that want nothing else.

import { seedAccounts, seedAdmin } from './accounts.mjs'
import { seedVerification } from './verification.mjs'
import { seedVisit } from './visit.mjs'

export const MODULES = {
  accounts: seedAccounts,
  admin: seedAdmin,
  verification: seedVerification,
  visit: seedVisit,
}

export const MODULE_NAMES = Object.keys(MODULES)
export const DEFAULT_MODULES = ['accounts', 'verification', 'visit']
