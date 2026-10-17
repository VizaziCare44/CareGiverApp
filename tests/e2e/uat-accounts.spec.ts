import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { anonClient, serviceClient } from './helpers'

// DEV-053 (item 7): the hand-run UAT account script, run for real against
// whatever project NEXT_PUBLIC_SUPABASE_URL points at (CI: the local stack), the
// same command docs/UAT Environment Runbook.md tells the Tech Lead to run.

function run(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, ['scripts/create-uat-account.mjs', ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

const password = (stdout: string) => {
  const match = stdout.match(/Password: (\S+)/)
  if (!match) throw new Error(`no password in output:\n${stdout}`)
  return match[1]
}

// a short lower-case name that is unique to this run, so runs never collide
const uniqueName = (label: string) => `${label}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

test.describe('DEV-053 — UAT account script', () => {
  for (const role of ['family_member', 'caregiver', 'admin'] as const) {
    test(`creates a ${role} on a uat- test address, with its own password, no phone and the right role`, async () => {
      const name = uniqueName(role.replace('_', '-'))
      const created = run(['--name', name, '--role', role, '--full-name', `UAT Tester ${name}`])
      expect(created.status).toBe(0)

      const email = `uat-${name}@test.vizazicare.example`
      expect(created.stdout).toContain(email)
      expect(created.stdout).toContain(`UAT ${role} account created`)

      // the password printed works
      const client = anonClient()
      const signedIn = await client.auth.signInWithPassword({ email, password: password(created.stdout) })
      expect(signedIn.error).toBeNull()

      const profile = await serviceClient().from('profiles').select('role, full_name, phone').eq('email', email).single()
      expect(profile.data).toEqual({ role, full_name: `UAT Tester ${name}`, phone: null })
    })
  }

  test('role defaults to a Family Member, and each account gets a different password', async () => {
    const [a, b] = [uniqueName('alpha'), uniqueName('beta')]
    const first = run(['--name', a])
    const second = run(['--name', b])
    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(password(first.stdout)).not.toBe(password(second.stdout))
    const profile = await serviceClient().from('profiles').select('role').eq('email', `uat-${a}@test.vizazicare.example`).single()
    expect(profile.data?.role).toBe('family_member')
  })

  test('refuses a missing, badly formed or unknown input before connecting to anything', async () => {
    const cases: string[][] = [
      [],
      ['--name', 'Peter'],
      ['--name', 'peter smith'],
      ['--name', 'peter@x'],
      ['--name', '-peter'],
      ['--name', 'a'.repeat(31)],
      ['--name', 'peter', '--role', 'superuser'],
    ]
    for (const args of cases) {
      const result = run(args)
      expect(result.status, args.join(' ')).toBe(1)
      expect(result.stderr).toContain('Usage')
      expect(result.stdout).not.toContain('Project:')
    }
  })

  test('refuses to run on production or any project not on the allow-list, before it connects', async () => {
    const fake = { SUPABASE_SERVICE_ROLE_KEY: 'not-a-real-key' }
    for (const url of [
      'https://abcdefghijklmnopqrst.supabase.co',
      // look-alikes of the allowed hosts
      'https://fzkwbajawfircwfzwbjg.supabase.co.evil.test',
      'https://localhost.evil.test',
      'https://notfzkwbajawfircwfzwbjg.supabase.co',
    ]) {
      const result = run(['--name', uniqueName('blocked')], { NEXT_PUBLIC_SUPABASE_URL: url, ...fake })
      expect(result.status, url).toBe(1)
      expect(result.stderr, url).toContain('Refusing to run')
      expect(result.stderr).toContain('never on production')
      // it never got as far as naming a project, let alone connecting to it
      expect(result.stdout).not.toContain('Project:')
      expect(result.stdout).not.toContain('Password:')
    }
  })

  test('a name that is already taken fails and points at the password reset', async () => {
    const name = uniqueName('twice')
    expect(run(['--name', name]).status).toBe(0)
    const again = run(['--name', name])
    expect(again.status).toBe(1)
    expect(again.stderr).toContain('already exists')
    expect(again.stderr).toContain(`npm run reset-password -- --email uat-${name}@test.vizazicare.example`)
    expect(again.stdout).not.toContain('Password:')
  })
})
