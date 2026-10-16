#!/usr/bin/env node
// DEV-035: reset the password of any account (family member, caregiver or
// Admin) by hand. Self-service recovery exists (DEV-027) but depends on email
// delivery, and the Admin's login is the key to verification, so the Tech Lead
// needs a way that does not. Run by whoever holds the service-role key.
//
// Sets a new random password and prints it once; it is not stored anywhere.
// Hand it over a secure channel and have the person change it after logging in.
//
// Usage:
//   node scripts/reset-password.mjs --email you@example.com
//   (reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local)

import { randomBytes } from 'node:crypto'
import { fail, parseArgs, serviceClient } from './_common.mjs'

async function main() {
  const { email } = parseArgs()
  if (!email) fail('Usage: node scripts/reset-password.mjs --email you@example.com')

  const supabase = serviceClient()

  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle()
  if (lookupError) fail(`Lookup failed: ${lookupError.message}`)
  if (!profile) fail(`No account found for ${email}.`)

  const password = randomBytes(12).toString('base64url')
  const { error } = await supabase.auth.admin.updateUserById(profile.id, { password })
  if (error) fail(`Failed to reset the password: ${error.message}`)

  console.log(`Password reset for ${profile.role} account ${email} (${profile.id})`)
  console.log(`Temporary password: ${password}`)
  console.log('Hand this over a secure channel and have them change it after logging in. This script does not store it anywhere.')
}

main()
