// Shared by the account scripts (provision-account, reset-password). These run
// by hand, by whoever holds the service-role key; nothing here is imported by
// the application.

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

export function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

export function parseArgs() {
  const args = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '')
    if (key) args[key] = argv[i + 1]
  }
  return args
}

export function fail(message) {
  console.error(message)
  process.exit(1)
}

/** Service-role client for the project named by NEXT_PUBLIC_SUPABASE_URL. The
 * host is printed first so the operator can see which project is being changed. */
export function serviceClient() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (set in .env.local or the environment).')
  }
  console.log(`Project: ${new URL(url).host}`)
  return createClient(url, serviceRoleKey)
}
