#!/usr/bin/env node
// DEV-009: manual admin account provisioning. There is no public admin
// signup route (FD-ACC §7.4) — this is the supported way to create one,
// run locally by whoever holds the service-role key (founder/Tech Lead).
//
// Creates the account via the Supabase admin API with role: 'admin' in
// app_metadata, so handle_new_user() inserts the profiles row as admin
// directly — pre-confirmed, no email round-trip, no separate SQL promotion
// step needed. app_metadata is writable only with the service-role key; the
// role is deliberately NOT read from user_metadata, which any signed-up user
// controls (DEV-028 finding, fixed in migration 0005 in backend-config).
// Apply migration 0005 to the target project before running this: on an older
// database the account would come out as a family member, which the check
// below reports.
//
// Usage:
//   node scripts/provision-admin.mjs --email you@example.com --name "Jane Doe" --phone "+254700000000"
//   (reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local)

import { readFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

function parseArgs() {
  const args = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '')
    if (key) args[key] = argv[i + 1]
  }
  return args
}

async function main() {
  loadEnvLocal()
  const { email, name, phone } = parseArgs()

  if (!email || !name || !phone) {
    console.error('Usage: node scripts/provision-admin.mjs --email you@example.com --name "Jane Doe" --phone "+254700000000"')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (set in .env.local or the environment).')
    process.exit(1)
  }

  const supabase = createClient(url, serviceRoleKey)
  const password = randomBytes(12).toString('base64url')

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone },
    app_metadata: { role: 'admin' },
  })

  if (error) {
    console.error(`Failed to create admin account: ${error.message}`)
    process.exit(1)
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
  if (profile?.role !== 'admin') {
    console.error(
      `Account ${email} (${data.user.id}) was created but its role is "${profile?.role}", not admin. ` +
        'The target database is probably missing migration 0005; apply it, then promote this account or delete it and re-run.',
    )
    process.exit(1)
  }

  console.log(`Admin account created: ${email} (${data.user.id})`)
  console.log(`Temporary password: ${password}`)
  console.log('Hand this to the admin over a secure channel and have them change it after first login — this script does not store it anywhere.')
}

main()
