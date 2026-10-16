#!/usr/bin/env node
// DEV-009 / DEV-035: manual Admin and Caregiver account provisioning. There is
// no public Admin or Caregiver signup and no in-app creation screen (FD-ACC
// §7.4, FD-VERIFY §5.7(b)): this is the only supported way to create one, run
// by whoever holds the service-role key (founder/Tech Lead). The full
// procedure is docs/Account Provisioning Runbook.md.
//
// Creates the account via the Supabase admin API with the role in
// app_metadata, which only the service-role key can write; the role is
// deliberately NOT read from user_metadata, which any signed-up user controls
// (DEV-028 finding, fixed in migration 0005 in backend-config). The account is
// pre-confirmed, so no email round-trip is needed. Apply migration 0005 to the
// target project first: on an older database the account would come out as a
// family member, which the check below reports.
//
// Usage:
//   node scripts/provision-account.mjs --role admin|caregiver --email you@example.com --name "Jane Doe" --phone "+254700000000"
//   (reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local)

import { randomBytes } from 'node:crypto'
import { fail, parseArgs, serviceClient } from './_common.mjs'

const ROLES = ['admin', 'caregiver']
const USAGE =
  'Usage: node scripts/provision-account.mjs --role admin|caregiver --email you@example.com --name "Jane Doe" --phone "+254700000000"'

async function main() {
  const { role, email, name, phone } = parseArgs()

  if (!role || !email || !name || !phone) fail(USAGE)
  if (!ROLES.includes(role)) fail(`--role must be one of: ${ROLES.join(', ')} (got "${role}").\n${USAGE}`)

  const supabase = serviceClient()
  const password = randomBytes(12).toString('base64url')

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone },
    app_metadata: { role },
  })

  if (error) fail(`Failed to create ${role} account: ${error.message}`)

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
  if (profile?.role !== role) {
    fail(
      `Account ${email} (${data.user.id}) was created but its role is "${profile?.role}", not ${role}. ` +
        'The target database is probably missing migration 0005; apply it, then fix this account or delete it and re-run.',
    )
  }

  console.log(`${role} account created: ${email} (${data.user.id})`)
  console.log(`Temporary password: ${password}`)
  console.log('Hand this to the account holder over a secure channel and have them change it after first login. This script does not store it anywhere.')
}

main()
