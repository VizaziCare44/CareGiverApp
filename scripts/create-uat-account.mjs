#!/usr/bin/env node
// DEV-053 (item 7): creates one UAT account on the dev project, for a person who
// will test the app during the UAT window. Run by hand by the Tech Lead, on their
// own machine, because it needs the service-role key (which never goes into
// Vercel, a chat or an email). The full procedure is docs/UAT Environment Runbook.md.
//
//   - the address is uat-<name>@test.vizazicare.example, so test accounts are easy
//     to tell from real ones and to remove afterwards;
//   - each account gets its own random password, printed once and stored nowhere;
//   - no phone number and no real data;
//   - created through the admin create-user path with email_confirm: true (harmless
//     with email confirmation off, and the account can still log in if it is on);
//   - the role goes in app_metadata, which only the service-role key can write, the
//     same way provision-account does it.
//
// It refuses to run against any project except the local stack and the dev
// project, and checks that BEFORE it connects: production is never on the list.
//
// Usage:
//   node scripts/create-uat-account.mjs --name peter [--role family_member|caregiver|admin] [--full-name "Peter (UAT)"]
//   (reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local)

import { randomBytes } from 'node:crypto'
import { fail, loadEnvLocal, parseArgs, serviceClient } from './_common.mjs'
import { ALLOWED_HOSTS, hostOf, isAllowedHost } from './seed/allow-list.mjs'

const ROLES = ['family_member', 'caregiver', 'admin']
const DOMAIN = 'test.vizazicare.example'
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const USAGE =
  'Usage: node scripts/create-uat-account.mjs --name peter [--role family_member|caregiver|admin] [--full-name "Peter (UAT)"]\n' +
  '  --name is a short lower-case name (letters, digits, single hyphens); the address becomes uat-<name>@' + DOMAIN

async function main() {
  const args = parseArgs()
  const name = args.name
  const role = args.role ?? 'family_member'

  if (!name) fail(USAGE)
  if (!NAME.test(name) || name.length > 30) fail(`--name "${name}" is not a short lower-case name.\n${USAGE}`)
  if (!ROLES.includes(role)) fail(`--role must be one of: ${ROLES.join(', ')} (got "${role}").\n${USAGE}`)

  // the allow-list guard: look at the target before any connection is made
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is required (set in .env.local or the environment).')
  const host = hostOf(url)
  if (!host) fail(`NEXT_PUBLIC_SUPABASE_URL is not a valid address: ${url}`)
  if (!isAllowedHost(host)) {
    fail(
      `Refusing to run: ${host} is not on the UAT allow-list (${ALLOWED_HOSTS.join(', ')}). ` +
        'UAT accounts are only ever created on the local stack and the dev project, never on production.',
    )
  }

  const email = `uat-${name}@${DOMAIN}`
  const fullName = args['full-name'] ?? `UAT ${name}`
  const password = randomBytes(12).toString('base64url')

  const supabase = serviceClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    ...(role === 'family_member' ? {} : { app_metadata: { role } }),
  })
  if (error) {
    const exists = /already|registered|exists/i.test(error.message)
    fail(
      `Failed to create ${email}: ${error.message}` +
        (exists ? `\nIt already exists. To give that person a new password: npm run reset-password -- --email ${email}` : ''),
    )
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
  if (profile?.role !== role) {
    fail(
      `Account ${email} (${data.user.id}) was created but its role is "${profile?.role}", not ${role}. ` +
        'The target database is probably missing migration 0005; apply it, then delete this account and run again.',
    )
  }

  console.log(`UAT ${role} account created: ${email} (${data.user.id})`)
  console.log(`Password: ${password}`)
  console.log('Give this to the one person it is for, over a secure channel. This script does not store it anywhere. The account holds no real data.')
}

main()
