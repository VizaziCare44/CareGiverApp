#!/usr/bin/env node
// DEV-054: the test seed (Test_Data_Strategy.md §8 T2, §4, §6). Creates the starter
// set of accounts, care recipients and bookings, by module. Today there is one
// module, `accounts`; DEV-051's seedVerification and DEV-056's e2e:fresh wrapper
// register theirs in scripts/seed/modules.mjs.
//
// THE GUARD (§6): it refuses to run unless the database address is localhost or the
// dev project on the explicit list in scripts/seed/allow-list.mjs. Production is
// never on it. The check is made BEFORE any connection, and a password that is
// missing or too short is refused before that too.
//
// THE PASSWORD: every seeded account gets the shared test password from the
// environment variable SEED_TEST_PASSWORD (at least 12 characters). It is never
// written in the repository and never printed.
//
// Idempotent, never deletes (see scripts/seed/accounts.mjs): safe to run again on
// the dev project, where a database reset is not an option.
//
// Usage:
//   SEED_TEST_PASSWORD=... node scripts/seed.mjs [--module accounts]
//   (reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local)

import { fail, loadEnvLocal, parseArgs, serviceClient } from './_common.mjs'
import { ALLOWED_HOSTS, hostOf, isAllowedHost } from './seed/allow-list.mjs'
import { MODULES } from './seed/modules.mjs'

const MIN_PASSWORD_LENGTH = 12
const USAGE = `Usage: SEED_TEST_PASSWORD=... node scripts/seed.mjs [--module ${Object.keys(MODULES).join('|')}]`

async function main() {
  const { module: moduleName = 'accounts' } = parseArgs()
  const seed = MODULES[moduleName]
  if (!seed) fail(`Unknown module "${moduleName}".\n${USAGE}`)

  // the guard, before anything connects
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is required (set in .env.local or the environment).')
  const host = hostOf(url)
  if (!host) fail(`NEXT_PUBLIC_SUPABASE_URL is not a valid address: ${url}`)
  if (!isAllowedHost(host)) {
    fail(
      `Refusing to run: ${host} is not on the seed allow-list (${ALLOWED_HOSTS.join(', ')}). ` +
        'The seed only ever writes to the local stack and the dev project, never to production.',
    )
  }

  const password = process.env.SEED_TEST_PASSWORD
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    fail(`SEED_TEST_PASSWORD is required, at least ${MIN_PASSWORD_LENGTH} characters, set in the environment (never in the repository).\n${USAGE}`)
  }

  const supabase = serviceClient() // prints "Project: <host>" first
  const summary = await seed({ supabase, password })
  console.log(`Seeded module "${moduleName}":`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => fail(`Seed failed: ${error.message}`))
