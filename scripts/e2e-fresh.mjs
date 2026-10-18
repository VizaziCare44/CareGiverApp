#!/usr/bin/env node
// DEV-056 (Test_Data_Strategy.md §8 T4, §4): ONE command that gets the tests onto a
// known database and runs them:
//
//   1. resets the LOCAL database from the migrations (supabase db reset),
//   2. runs the seed, by module (scripts/seed/modules.mjs),
//   3. runs Playwright.
//
// CI calls this same command. See tests/README.md for running it cold.
//
// Usage:
//   npm run e2e:fresh                      reset, seed every module, run all tests
//   npm run e2e:fresh -- --seed accounts   seed only these modules (comma separated)
//   npm run e2e:fresh -- --no-reset        keep the database as it is (local only)
//   npm run e2e:fresh -- --dev-fallback    the fallback on the dev project: NO reset
//   npm run e2e:fresh -- --dry-run         print the plan and stop
//   anything else is passed to Playwright: npm run e2e:fresh -- --grep "route guarding"
//
// WHICH DATABASE: by default the local stack. Its address and keys come from the
// environment (CI exports them) or, if they are not set, from `supabase status`;
// .env.local is NOT read, so a developer whose .env.local points at the dev project
// cannot hit it by accident. THE RESET ONLY EVER RUNS ON THE LOCAL STACK. The dev
// project is reached only with --dev-fallback, and then there is no reset (the seed
// is idempotent and never deletes); anything not on scripts/seed/allow-list.mjs,
// production above all, is refused before anything runs.
//
// THE PASSWORD: the shared test password for the seeded accounts is
// SEED_TEST_PASSWORD from the environment, or one made up for this run and kept
// nowhere. It is never printed.

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fail, loadEnvLocal } from './_common.mjs'
import { ALLOWED_HOSTS, hostOf, isAllowedHost } from './seed/allow-list.mjs'
import { MODULE_NAMES } from './seed/modules.mjs'

const LOCAL_HOSTS = ['localhost', '127.0.0.1']
const BACKEND_DIR = process.env.E2E_BACKEND_CONFIG_DIR ?? 'backend-config'
const USAGE =
  'Usage: npm run e2e:fresh -- [--seed accounts[,..]] [--no-reset] [--dev-fallback] [--dry-run] [playwright arguments]\n' +
  `  seed modules: ${MODULE_NAMES.join(', ')}`

function parseFlags(argv) {
  const flags = { dryRun: false, noReset: false, devFallback: false, seed: null, rest: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--no-reset') flags.noReset = true
    else if (arg === '--dev-fallback') flags.devFallback = true
    else if (arg === '--seed') flags.seed = argv[(i += 1)] ?? ''
    else if (arg === '--help' || arg === '-h') {
      console.log(USAGE)
      process.exit(0)
    } else flags.rest.push(arg)
  }
  return flags
}

/** The local stack's address and keys, as `supabase status -o env` prints them. */
function localStackEnv() {
  const result = spawnSync('supabase', ['status', '-o', 'env'], { cwd: BACKEND_DIR, encoding: 'utf8', shell: process.platform === 'win32' })
  if (result.error || result.status !== 0) {
    fail(
      'Could not read the local Supabase stack. Is the Supabase CLI installed and the stack running? ' +
        `(from ${BACKEND_DIR}: supabase start). Or set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY yourself.\n${result.stderr ?? ''}`,
    )
  }
  const get = (name) => result.stdout.split('\n').find((line) => line.startsWith(`${name}=`))?.slice(name.length + 1).replace(/"/g, '').trim()
  const env = { NEXT_PUBLIC_SUPABASE_URL: get('API_URL'), NEXT_PUBLIC_SUPABASE_ANON_KEY: get('ANON_KEY'), SUPABASE_SERVICE_ROLE_KEY: get('SERVICE_ROLE_KEY') }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) fail('`supabase status` did not give the stack address and keys. Is the stack running?')
  return env
}

function run(label, command, args, options = {}) {
  console.log(`\n== ${label}`)
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options })
  if (result.error) fail(`${label}: could not run "${command}": ${result.error.message}`)
  return result.status ?? 1
}

async function waitForAuth(url) {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/auth/v1/health`)
      if (response.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  fail('The local stack did not come back after the reset (its auth service never answered).')
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))

  // which seed modules: all registered ones by default, in registry order
  const modules = flags.seed === null ? MODULE_NAMES : flags.seed.split(',').map((name) => name.trim()).filter(Boolean)
  if (modules.length === 0) fail(`--seed needs at least one module.\n${USAGE}`)
  const unknown = modules.filter((name) => !MODULE_NAMES.includes(name))
  if (unknown.length > 0) fail(`Unknown seed module: ${unknown.join(', ')}.\n${USAGE}`)

  // which database
  if (flags.devFallback) loadEnvLocal()
  let target = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  let host
  if (target.NEXT_PUBLIC_SUPABASE_URL) {
    host = hostOf(target.NEXT_PUBLIC_SUPABASE_URL)
    if (!host) fail(`NEXT_PUBLIC_SUPABASE_URL is not a valid address: ${target.NEXT_PUBLIC_SUPABASE_URL}`)
  } else if (flags.dryRun) {
    host = 'localhost' // a real run reads the local stack with `supabase status`
  } else if (flags.devFallback) {
    fail('--dev-fallback needs the dev project in .env.local (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).')
  } else {
    target = localStackEnv()
    host = hostOf(target.NEXT_PUBLIC_SUPABASE_URL)
  }

  if (!isAllowedHost(host)) {
    fail(`Refusing to run: ${host} is not on the allow-list (${ALLOWED_HOSTS.join(', ')}). The tests and the seed only ever write to the local stack and the dev project, never to production.`)
  }
  const isLocal = LOCAL_HOSTS.includes(host)
  if (!isLocal && !flags.devFallback) {
    fail(
      `${host} is the dev project. e2e:fresh never resets it. To run the tests against it WITHOUT a reset (the fallback, Test_Data_Strategy.md §4), add --dev-fallback.`,
    )
  }
  const reset = isLocal && !flags.noReset

  // the plan, printed first
  console.log(`e2e:fresh on ${host}${isLocal ? ' (the local stack)' : ' (the dev project: fallback, no reset)'}:`)
  console.log(reset ? '  1. reset the local database from the migrations' : `  1. no reset (${isLocal ? '--no-reset' : 'the dev project is never reset'})`)
  modules.forEach((name, index) => console.log(`  ${index + 2}. seed module "${name}"`))
  console.log(`  ${modules.length + 2}. run Playwright${flags.rest.length ? ` (${flags.rest.join(' ')})` : ''}`)
  if (flags.dryRun) {
    console.log('\n(dry run: nothing was done)')
    return
  }

  // the password: from the environment, or one for this run alone
  let password = process.env.SEED_TEST_PASSWORD
  if (!password) {
    password = `Seed-${randomBytes(12).toString('hex')}`
    if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${password}`)
  }
  const childEnv = { ...process.env, ...target, SEED_TEST_PASSWORD: password }

  if (reset) {
    if (!existsSync(join(BACKEND_DIR, 'supabase', 'config.toml'))) {
      fail(`No Supabase project in ${BACKEND_DIR} (set E2E_BACKEND_CONFIG_DIR to the backend-config folder).`)
    }
    if (run('Reset the local database from the migrations', 'supabase', ['db', 'reset'], { cwd: BACKEND_DIR, env: childEnv }) !== 0) {
      fail('The database reset failed; nothing was seeded and no test was run.')
    }
    await waitForAuth(target.NEXT_PUBLIC_SUPABASE_URL)
  }

  for (const name of modules) {
    if (run(`Seed module "${name}"`, process.execPath, ['scripts/seed.mjs', '--module', name], { env: childEnv }) !== 0) {
      fail(`The seed (module "${name}") failed; no test was run.`)
    }
  }

  const status = run('Run Playwright', 'npx', ['playwright', 'test', ...flags.rest], { env: childEnv })
  process.exit(status)
}

main().catch((error) => fail(`e2e:fresh failed: ${error.message}`))
