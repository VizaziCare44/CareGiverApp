import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
// Local dev stack's well-known service-role key — test-setup only, never
// used by application code. Resolves the QA doc's flagged CI dependency:
// each test creates its own unique account so runs never collide.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Supabase's public signup endpoint rejects the RFC 2606 reserved
// example.com/example.test addresses outright (email_address_invalid) as
// an anti-abuse measure — any other domain passes its validation, reserved
// or not, since it doesn't check DNS/MX records. Avoid "example.*" here.
export function randomEmail() {
  return `fm-${Date.now()}-${Math.floor(Math.random() * 100000)}@vizazi-qa.test`
}

export const TEST_PASSWORD = 'Sup3rSecret!'

export function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY)
}

export function serviceClient() {
  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for this test setup step')
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

/** API-level signup, used for test preconditions that don't themselves
 * assert on the Sign Up screen (keeps each spec focused on what it's
 * actually testing). Creates the user via the service-role admin API
 * (pre-confirmed) rather than the public signUp() endpoint: the public
 * endpoint rejects example.test-style addresses as invalid and, separately,
 * would leave the account unconfirmed (email confirmation is required on
 * this project), so a subsequent UI login would fail either way. */
export async function apiSignUp({ fullName, phone }: { fullName: string; phone: string }) {
  const email = randomEmail()
  const svc = serviceClient()
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, role: 'family_member' },
  })
  if (error || !data.user) throw new Error(`apiSignUp failed: ${error?.message}`)

  const client = anonClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (signInError) throw new Error(`apiSignUp sign-in failed: ${signInError.message}`)

  return { email, userId: data.user.id, client }
}

export async function apiAddRecipient(client: ReturnType<typeof anonClient>, accountId: string, name: string) {
  const { data, error } = await client
    .from('care_recipients')
    .insert({ account_id: accountId, name })
    .select('id')
    .single()
  if (error) throw new Error(`apiAddRecipient failed: ${error.message}`)
  return data.id as string
}

export async function promoteToAdmin(userId: string) {
  const svc = serviceClient()
  const { error } = await svc.from('profiles').update({ role: 'admin' }).eq('id', userId)
  if (error) throw new Error(`promoteToAdmin failed: ${error.message}`)
}

// expectedUrl defaults to the family-member destination; pass '**/admin/queue'
// when logging in an account already promoted via promoteToAdmin() — the app
// correctly routes admins there instead, so a hardcoded '**/recipients' wait
// hangs forever for that case (was misread as an auth bug; the app was right,
// this helper's fixed expectation wasn't).
export async function logInViaUI(page: Page, email: string, password = TEST_PASSWORD, expectedUrl = '**/recipients') {
  await page.goto('/log-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL(expectedUrl)
}
