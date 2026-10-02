import { test, expect, type Browser } from '@playwright/test'
import {
  anonClient,
  apiAddRecipient,
  apiSignUp,
  generateRecoveryTokenHash,
  logInViaUI,
  promoteToAdmin,
  randomEmail,
  TEST_PASSWORD,
} from './helpers'

// Maps 1:1 to docs/VIzazi CAre - QA Test Cases Account & Booking Flow.md.
// Test names match the Test ID column so a failing CI run maps straight
// back to that table without translation.

test.describe('AC-001 — Account creation', () => {
  test('TC-ACC-001', async ({ page }) => {
    const email = randomEmail()
    await page.goto('/sign-up')
    await page.getByLabel('Full name').fill('Amara Otieno')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Phone number').fill('+254712345678')
    await page.getByLabel('Password', { exact: false }).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign up' }).click()

    // Email confirmation is required on this project (§7.3/DEV-008) —
    // signUp() creates the account (auth.users + profiles row, via the
    // handle_new_user trigger) but issues no session until the confirmation
    // link is followed, so the app correctly shows "Check your email" here
    // rather than routing straight to the Care Recipient List. The QA doc's
    // original expected result (direct routing) predates that decision.
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()
  })

  test('TC-ACC-002', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByLabel('Full name').fill('Amara Otieno')
    await page.getByLabel('Email address').fill('not-an-email')
    await page.getByLabel('Email address').blur()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()

    await page.getByLabel('Phone number').fill('+254712345678')
    await page.getByLabel('Password', { exact: false }).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign up' }).click()

    await expect(page).toHaveURL(/sign-up/)
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  })

  test('TC-ACC-003', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByLabel('Email address').fill(randomEmail())
    await page.getByLabel('Phone number').fill('+254712345678')
    await page.getByLabel('Password', { exact: false }).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign up' }).click()

    await expect(page).toHaveURL(/sign-up/)
    await expect(page.getByText('Enter your full name.')).toBeVisible()
  })
})

test.describe('AC-002 — Bundle restriction', () => {
  test('TC-ACC-004', async ({ page }) => {
    const { email, userId, client } = await apiSignUp({ fullName: 'Brenda Wanjiru', phone: '+254700000001' })
    const recipientId = await apiAddRecipient(client, userId, 'Grandma Njeri')
    await logInViaUI(page, email)

    await page.goto(`/book/bundle?recipientId=${recipientId}&recipientName=Grandma%20Njeri`)

    await expect(page.getByTestId('bundle-card-medicheck')).toBeVisible()
    await expect(page.getByTestId('bundle-card-doctors_day_out')).toBeVisible()

    const bodyText = await page.locator('main').innerText()
    expect(bodyText).not.toContain('Full Circle')
    expect(bodyText).not.toContain('Peace of Mind')
    // BR-005 — no pricing figures anywhere on this screen
    expect(bodyText).not.toMatch(/KES|\$\s?\d|Ksh/i)
  })

  test('TC-ACC-005', async () => {
    const { userId, client } = await apiSignUp({ fullName: 'Caleb Mwangi', phone: '+254700000002' })
    const recipientId = await apiAddRecipient(client, userId, 'Grandpa Kamau')

    const { error } = await client.from('bookings').insert({
      account_id: userId,
      care_recipient_id: recipientId,
      // @ts-expect-error deliberately outside the bundle_code enum (BR-001)
      bundle_code: 'full_circle',
      requested_datetime: new Date().toISOString(),
      status: 'requested',
    })

    expect(error).toBeTruthy()

    const { data: bookings } = await client.from('bookings').select('id').eq('account_id', userId)
    expect(bookings?.length ?? 0).toBe(0)
  })
})

async function completeBookingFlow(page: import('@playwright/test').Page, recipientId: string, recipientName: string) {
  await page.goto(`/book/bundle?recipientId=${recipientId}&recipientName=${encodeURIComponent(recipientName)}`)
  await page.getByTestId('bundle-card-medicheck').click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.waitForURL('**/book/datetime')
  const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await page.locator('#visit-date').fill(date)
  await page.locator('#visit-time').fill('09:00')
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.waitForURL('**/book/review')
}

test.describe('AC-003 — Booking visible to Admin', () => {
  test('TC-ACC-006', async ({ page, browser }: { page: import('@playwright/test').Page; browser: Browser }) => {
    // Unique per run: the admin queue shows every account's bookings, so a
    // fixed recipient name collides with leftover rows from prior runs and
    // makes getByText(name) match many elements instead of one.
    const recipientName = `Uncle Otieno ${Date.now()}`
    const { email, userId, client } = await apiSignUp({ fullName: 'Diana Achieng', phone: '+254700000003' })
    const recipientId = await apiAddRecipient(client, userId, recipientName)
    await logInViaUI(page, email)

    await completeBookingFlow(page, recipientId, recipientName)

    await page.getByTestId('submit-booking').click()
    await expect(page.getByText('Submitting…')).toBeVisible()
    await page.waitForURL('**/book/confirmation')
    await expect(page.getByText('Request received')).toBeVisible()

    // admin visibility — separate authenticated context
    const { email: adminEmail, userId: adminId } = await apiSignUp({ fullName: 'Admin User', phone: '+254700000099' })
    await promoteToAdmin(adminId)
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    await logInViaUI(adminPage, adminEmail, TEST_PASSWORD, '**/admin/queue')
    await expect(adminPage.getByText(recipientName)).toBeVisible()
    await adminContext.close()
  })

  test('TC-ACC-007', async ({ page }) => {
    const { email, userId, client } = await apiSignUp({ fullName: 'Edwin Kiptoo', phone: '+254700000004' })
    const recipientId = await apiAddRecipient(client, userId, 'Aunt Wambui')
    await logInViaUI(page, email)
    await completeBookingFlow(page, recipientId, 'Aunt Wambui')

    // Fire a rapid second tap without awaiting it: if the first click's
    // submission resolves fast, the page navigates and the button unmounts
    // mid-navigation — awaiting a second force-click against that locator
    // in a Promise.all then retries forever (the element never reappears),
    // hanging the test for its full timeout. Only the resulting booking
    // count below actually matters for this test's assertion.
    const submit = page.getByTestId('submit-booking')
    await submit.click()
    void submit.click({ force: true, timeout: 2000 }).catch(() => {})
    await page.waitForURL('**/book/confirmation')

    const { data: bookings } = await client.from('bookings').select('id').eq('account_id', userId)
    expect(bookings?.length).toBe(1)
  })

  test('TC-ACC-014', async ({ page }) => {
    const { email, userId, client } = await apiSignUp({ fullName: 'Faith Nyambura', phone: '+254700000005' })
    const recipientId = await apiAddRecipient(client, userId, 'Nyanya Wanjiku')
    await logInViaUI(page, email)
    await completeBookingFlow(page, recipientId, 'Nyanya Wanjiku')

    // submitBooking is a Server Action ('use server') — the Supabase insert
    // runs server-side, so intercepting '**/rest/v1/bookings**' (a
    // browser-originated request) never catches anything; the action
    // silently succeeds on its real first attempt and the error state
    // never triggers. The browser request to actually intercept is the
    // Server Action's own POST, sent to the current page URL.
    let firstAttempt = true
    await page.route('**/book/review', async (route) => {
      if (firstAttempt && route.request().method() === 'POST') {
        firstAttempt = false
        await route.abort('failed')
        return
      }
      await route.continue()
    })

    await page.getByTestId('submit-booking').click()
    await expect(page.getByText("Couldn't submit")).toBeVisible()

    await page.getByRole('button', { name: 'Retry' }).click()
    await page.waitForURL('**/book/confirmation')

    const { data: bookings } = await client.from('bookings').select('id').eq('account_id', userId)
    expect(bookings?.length).toBe(1)
  })
})

test.describe('AC-004 — Care notes are optional', () => {
  test('TC-ACC-008', async ({ page }) => {
    const { email } = await apiSignUp({ fullName: 'Grace Muthoni', phone: '+254700000006' })
    await logInViaUI(page, email)
    await page.goto('/recipients/new')
    // Not getByLabel: this field's id comes from React's useId() (e.g.
    // ":Rqfnnj6:") — the for/id pairing is correct and the label is
    // visibly associated, but Playwright's getByLabel hangs resolving it
    // specifically because of the colons, confirmed against the Care
    // notes textarea on this same page (a stable, non-generated id),
    // which resolves fine via getByLabel. getByRole sidesteps it entirely.
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Baba Kariuki')
    await page.getByRole('button', { name: 'Save' }).click()

    await page.waitForURL('**/recipients')
    await expect(page.getByText('Baba Kariuki', { exact: true })).toBeVisible()
  })

  test('TC-ACC-009', async ({ page }) => {
    const { email } = await apiSignUp({ fullName: 'Henry Odhiambo', phone: '+254700000007' })
    await logInViaUI(page, email)
    await page.goto('/recipients/new')
    await page.getByLabel('Care notes').fill('Diabetic, needs insulin reminder')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page).toHaveURL(/recipients\/new/)
    await expect(page.getByText('Name is required.')).toBeVisible()
  })
})

test.describe('AC-005 — Returning-user login', () => {
  test('TC-ACC-010', async ({ page }) => {
    const { email } = await apiSignUp({ fullName: 'Irene Chebet', phone: '+254700000008' })
    await logInViaUI(page, email)
    await expect(page).toHaveURL(/recipients/)
  })

  test('TC-ACC-011', async ({ page }) => {
    const { email } = await apiSignUp({ fullName: 'James Mutua', phone: '+254700000009' })

    await page.goto('/log-in')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill('WrongPassword123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText('Email or password incorrect.')).toBeVisible()

    await page.getByLabel('Email address').fill(randomEmail())
    await page.getByLabel('Password').fill('WrongPassword123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText('Email or password incorrect.')).toBeVisible()
    await expect(page).toHaveURL(/log-in/)
  })
})

test.describe('AC-006 — Leave-without-finishing warning', () => {
  test('TC-ACC-012', async ({ page }) => {
    const { email, userId, client } = await apiSignUp({ fullName: 'Karen Achola', phone: '+254700000010' })
    const recipientId = await apiAddRecipient(client, userId, 'Mzee Kimani')
    await logInViaUI(page, email)

    await page.goto(`/book/bundle?recipientId=${recipientId}&recipientName=Mzee%20Kimani`)
    await page.getByTestId('booking-back').click()
    await expect(page.getByText("Leave without finishing?")).toBeVisible()

    await page.getByTestId('leave-modal-stay').click()
    await expect(page.getByText("Leave without finishing?")).not.toBeVisible()
    await expect(page).toHaveURL(/book\/bundle/)

    await page.getByTestId('booking-back').click()
    await page.getByTestId('leave-modal-leave').click()
    await expect(page).toHaveURL(/recipients/)
  })

  test('TC-ACC-013', async ({ page }) => {
    const { email } = await apiSignUp({ fullName: 'Lucy Wairimu', phone: '+254700000011' })
    await logInViaUI(page, email)
    await page.goto('/recipients/new')
    await page.goBack()
    await expect(page.getByText("Leave without finishing?")).not.toBeVisible()
  })
})

// DEV-027 — self-service password reset. Not in the original TC-ACC-001–014
// table (that spec predates this scope change); numbered to continue it.
test.describe('DEV-027 — Password reset', () => {
  test('TC-ACC-015', async ({ page }) => {
    const { email } = await apiSignUp({ fullName: 'Moses Kariuki', phone: '+254700000012' })

    await page.goto('/log-in')
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page).toHaveURL(/forgot-password/)

    await page.getByLabel('Email address').fill(email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

    // The real flow mails this token_hash; generating it directly via the
    // admin API avoids a second real send on top of resetPasswordForEmail's
    // own (already consumed above), against Supabase's shared send-rate
    // limit (same constraint flagged for TC-ACC-001).
    const tokenHash = await generateRecoveryTokenHash(email)
    await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password`)
    await expect(page).toHaveURL(/reset-password/)

    const newPassword = 'BrandNewPassword789'
    await page.getByLabel('New password').fill(newPassword)
    await page.getByRole('button', { name: 'Save new password' }).click()
    await page.waitForURL('**/recipients')

    const client = anonClient()
    const { error: oldError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
    expect(oldError).toBeTruthy()

    const { error: newError } = await client.auth.signInWithPassword({ email, password: newPassword })
    expect(newError).toBeFalsy()
  })

  test('TC-ACC-016', async ({ page }) => {
    // Unauthenticated access to /reset-password (no prior recovery session)
    // must bounce to /log-in — it's gated like any other protected route.
    await page.goto('/reset-password')
    await expect(page).toHaveURL(/log-in/)
  })
})
