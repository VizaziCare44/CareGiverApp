// The registry of seed modules, in the order they run. One place: `npm run seed`
// (scripts/seed.mjs) and the `e2e:fresh` wrapper (scripts/e2e-fresh.mjs) both read
// it. DEV-051's seedVerification is registered by adding one line here, after
// `accounts` (the verification rows belong to accounts that already exist).

import { seedAccounts } from './accounts.mjs'

export const MODULES = {
  accounts: seedAccounts,
}

export const MODULE_NAMES = Object.keys(MODULES)
