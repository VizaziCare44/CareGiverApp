import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'

// DEV-056: the plan of the `e2e:fresh` wrapper, checked with --dry-run (which
// changes nothing). The real run is what CI does with every push; what these tests
// pin down is WHEN it resets, WHAT it seeds, and that it refuses the wrong database.

const LOCAL = 'http://127.0.0.1:54321'
const DEV = 'https://fzkwbajawfircwfzwbjg.supabase.co'

function plan(args: string[], env: Record<string, string | undefined>) {
  const result = spawnSync(process.execPath, ['scripts/e2e-fresh.mjs', '--dry-run', ...args], {
    encoding: 'utf8',
    // the real environment minus anything that would decide the target, plus what the case sets
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: undefined, SEED_TEST_PASSWORD: 'never-printed-password-1', ...env },
  })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

test.describe('DEV-056 — e2e:fresh', () => {
  test('on the local stack it resets, seeds every module, then runs Playwright, in that order', () => {
    const result = plan([], { NEXT_PUBLIC_SUPABASE_URL: LOCAL })
    expect(result.status, result.stderr).toBe(0)
    const out = result.stdout
    expect(out).toContain('(the local stack)')
    const reset = out.indexOf('reset the local database from the migrations')
    const seed = out.indexOf('seed module "accounts"')
    const run = out.indexOf('run Playwright')
    expect(reset).toBeGreaterThan(-1)
    expect(seed).toBeGreaterThan(reset)
    expect(run).toBeGreaterThan(seed)
    expect(out).toContain('nothing was done')

    // a plain run seeds the full set: accounts, then the verification rows that need them
    const verification = out.indexOf('seed module "verification"')
    expect(verification).toBeGreaterThan(seed)
    expect(run).toBeGreaterThan(verification)
    // admin1 alone is for the runs that ask for it, not a plain run
    expect(out).not.toContain('seed module "admin"')
  })

  test('the empty states: --seed admin is admin1 alone, --seed accounts has caregivers and none Verified', () => {
    const adminOnly = plan(['--seed', 'admin'], { NEXT_PUBLIC_SUPABASE_URL: LOCAL })
    expect(adminOnly.status, adminOnly.stderr).toBe(0)
    expect(adminOnly.stdout).toContain('seed module "admin"')
    expect(adminOnly.stdout).not.toContain('seed module "accounts"')
    expect(adminOnly.stdout).not.toContain('seed module "verification"')

    const noVerification = plan(['--seed', 'accounts'], { NEXT_PUBLIC_SUPABASE_URL: LOCAL })
    expect(noVerification.status, noVerification.stderr).toBe(0)
    expect(noVerification.stdout).toContain('seed module "accounts"')
    expect(noVerification.stdout).not.toContain('seed module "verification"')

    // the modules named run in the order given
    const both = plan(['--seed', 'accounts,verification'], { NEXT_PUBLIC_SUPABASE_URL: LOCAL })
    expect(both.stdout.indexOf('seed module "accounts"')).toBeLessThan(both.stdout.indexOf('seed module "verification"'))
  })

  test('--no-reset keeps the database; --seed picks the modules; the rest goes to Playwright', () => {
    const result = plan(['--no-reset', '--seed', 'accounts', '--grep', 'route guarding'], { NEXT_PUBLIC_SUPABASE_URL: LOCAL })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('no reset (--no-reset)')
    expect(result.stdout).not.toContain('reset the local database')
    expect(result.stdout).toContain('seed module "accounts"')
    expect(result.stdout).toContain('run Playwright (--grep route guarding)')

    const unknown = plan(['--seed', 'accounts,everything'], { NEXT_PUBLIC_SUPABASE_URL: LOCAL })
    expect(unknown.status).toBe(1)
    expect(unknown.stderr).toContain('Unknown seed module: everything')
    const none = plan(['--seed', ''], { NEXT_PUBLIC_SUPABASE_URL: LOCAL })
    expect(none.status).toBe(1)
    expect(none.stderr).toContain('at least one module')
  })

  test('the dev project is never reset: refused without --dev-fallback, and with it there is no reset', () => {
    const refused = plan([], { NEXT_PUBLIC_SUPABASE_URL: DEV })
    expect(refused.status).toBe(1)
    expect(refused.stderr).toContain('never resets it')
    expect(refused.stderr).toContain('--dev-fallback')
    expect(refused.stdout).not.toContain('reset the local database')

    const fallback = plan(['--dev-fallback'], { NEXT_PUBLIC_SUPABASE_URL: DEV })
    expect(fallback.status, fallback.stderr).toBe(0)
    expect(fallback.stdout).toContain('the dev project: fallback, no reset')
    expect(fallback.stdout).toContain('the dev project is never reset')
    expect(fallback.stdout).not.toContain('reset the local database')
    expect(fallback.stdout).toContain('seed module "accounts"')
  })

  test('refuses production and anything off the allow-list, before it does anything, even with --dev-fallback', () => {
    for (const url of [
      'https://abcdefghijklmnopqrst.supabase.co',
      'https://fzkwbajawfircwfzwbjg.supabase.co.evil.test',
      'https://localhost.evil.test',
    ]) {
      for (const args of [[], ['--dev-fallback'], ['--no-reset']]) {
        const result = plan(args, { NEXT_PUBLIC_SUPABASE_URL: url })
        expect(result.status, `${url} ${args.join(' ')}`).toBe(1)
        expect(result.stderr).toContain('is not on the allow-list')
        expect(result.stderr).toContain('never to production')
        expect(result.stdout).not.toContain('seed module')
      }
    }
  })

  test('never prints the password', () => {
    const result = plan([], { NEXT_PUBLIC_SUPABASE_URL: LOCAL })
    expect(result.stdout + result.stderr).not.toContain('never-printed-password-1')
  })
})
