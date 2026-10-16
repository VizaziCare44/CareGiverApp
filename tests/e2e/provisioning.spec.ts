import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { anonClient, createUserWithRole, randomEmail, serviceClient, TEST_PASSWORD } from './helpers'

// DEV-035: the hand-run account scripts, run for real (the same commands the
// runbook in docs/Account Provisioning Runbook.md tells the Tech Lead to run)
// against whatever project NEXT_PUBLIC_SUPABASE_URL points at.

function run(script: string, args: string[]) {
  const result = spawnSync(process.execPath, [`scripts/${script}`, ...args], { encoding: 'utf8' })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function temporaryPassword(stdout: string) {
  const match = stdout.match(/Temporary password: (\S+)/)
  if (!match) throw new Error(`no temporary password in output:\n${stdout}`)
  return match[1]
}

test.describe('DEV-035 — Account provisioning scripts', () => {
  for (const role of ['admin', 'caregiver'] as const) {
    test(`provision-account creates a ${role} who can sign in`, async () => {
      const email = randomEmail()
      const created = run('provision-account.mjs', ['--role', role, '--email', email, '--name', `Test ${role}`, '--phone', '+254700000040'])
      expect(created.status).toBe(0)

      const client = anonClient()
      const { error } = await client.auth.signInWithPassword({ email, password: temporaryPassword(created.stdout) })
      expect(error).toBeNull()

      const { data } = await serviceClient().from('profiles').select('role, full_name').eq('email', email).single()
      expect(data).toEqual({ role, full_name: `Test ${role}` })
    })
  }

  test('provision-account refuses a missing or unknown role', async () => {
    const email = randomEmail()
    const base = ['--email', email, '--name', 'Nobody', '--phone', '+254700000041']

    const missing = run('provision-account.mjs', base)
    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain('Usage')

    const familyMember = run('provision-account.mjs', ['--role', 'family_member', ...base])
    expect(familyMember.status).toBe(1)
    expect(familyMember.stderr).toContain('--role must be one of')

    const { data } = await serviceClient().from('profiles').select('id').eq('email', email)
    expect(data).toEqual([])
  })

  test('reset-password sets a new working password and ends the old one', async () => {
    const { email } = await createUserWithRole('family_member', 'Forgetful Family')

    const reset = run('reset-password.mjs', ['--email', email])
    expect(reset.status).toBe(0)
    const newPassword = temporaryPassword(reset.stdout)

    const client = anonClient()
    const oldLogin = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
    expect(oldLogin.error).not.toBeNull()
    const newLogin = await client.auth.signInWithPassword({ email, password: newPassword })
    expect(newLogin.error).toBeNull()
  })

  test('reset-password refuses an unknown email', async () => {
    const result = run('reset-password.mjs', ['--email', randomEmail()])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No account found')
  })
})
