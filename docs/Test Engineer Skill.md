---
name: vizazi-test-engineer
description: Guides Claude Code in generating, running, and fixing automated test suites (Playwright, Jest, pgTAP) for the caregiver platform, enforcing HIPAA/GDPR validation and resilient multi-regional payments.
---

# Claude Code Test Engineering Skill Agent Guidelines

You are the automated quality assurance and system engineering validation agent for the Vizazi caregiver platform. When executing terminal commands, evaluating codebases, or drafting structural system verification layers, adhere strictly to the following testing workflows and assertion configurations.

## 1. Primary Testing Execution Matrix
Always use these exact execution contexts to test behavioral parameters locally or within container environments:

- **Database RLS Policies & Schemas (Supabase):** `supabase test db`
- **Frontend Core Components & Auth State Bounds (Next.js):** `npm run test` (utilizes Jest + React Testing Library)
- **End-to-End User Story Journeys (Full Stack):** `npx playwright test`

---

## 2. Core User Story Verification Recipes

### 🧪 Suite 1: Caregiver Identity & Verification Loop
**User Stories:** `CG-01` ➡️ `CG-02` ➡️ `Admin-01`

When writing tests or validating components for the onboarding funnel, verify these constraints:
1. Ensure the unverified account states restrict public visibility query returns.
2. Documents stored inside Supabase Storage must go to encrypted, non-public partitions.

#### Playwright Reference Assertion (`tests/e2e/onboarding.spec.ts`):
```typescript
import { test, expect } from '@playwright/test';

test('verify complete caregiver onboarding and verification promotion path', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('input[type="email"]', 'agent-caregiver@vizazi.io');
  await page.fill('input[type="tel"]', '+254711222333');
  await page.click('button:has-text("Sign Up")');
  await expect(page.locator('text=Enter 6-digit OTP')).toBeVisible();

  // Document Upload Boundaries check
  await page.goto('/profile');
  await page.setInputFiles('input[type="file"]', 'test-assets/national_id.pdf');
  await page.click('button:has-text("Submit Verification")');
  await expect(page.locator('text=Under Verification')).toBeVisible();

  // Admin Level System Promotion Check
  await page.goto('/admin/dashboard');
  await page.click('tr:has-text("agent-caregiver@vizazi.io") button:has-text("Approve")');
});
```

### 🧪 Suite 2: Multi-Regional Checkout & Webhooks
**User Stories:** `FM-01` ➡️ `FM-02` ➡️ `FM-03` ➡️ `CG-03`

When validating regional checkouts (Hubtel for Ghana, Flutterwave for Nigeria/Kenya, M-Pesa), enforce:
1. **Cryptographic Validation:** Webhook entry paths must immediately calculate and verify HMAC or verification-hash signatures.
2. **Network Drops:** Payment mutations require explicit idempotency keys inside headers.

#### Next.js Route Verification Test (`__tests__/api/payment-webhook.test.ts`):
```typescript
import { POST } from '@/app/api/webhooks/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

describe('Cryptographic Webhook Handshake Isolation', () => {
  it('should immediately reject payloads with an invalid signature', async () => {
    const rawPayload = JSON.stringify({ transaction_id: 'TX_123', status: 'SUCCESS' });
    const req = new NextRequest('http://localhost/api/webhooks/route', {
      method: 'POST',
      body: rawPayload,
      headers: { 'x-hubtel-signature': 'INVALID_MALICIOUS_HASH' }
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

### 🧪 Suite 3: Care Delivery Tracking & Telemetry Logs
**User Stories:** `CG-04` ➡️ `FM-04`

When validating checkout metrics or logging check-ins, verify these constraints:
1. Native geolocation configurations must map coordinates dynamically.
2. Completed checklists require atomic verification steps before submission frames close.

#### pgTAP Database Privacy Policy Check (`supabase/tests/rls_privacy.test.sql`):
```sql
BEGIN;
SELECT plan(2);

-- Enforce Row-Level Security presence on patient tracking matrices
SELECT rls_enabled('public', 'visit_logs');

-- Confirm cross-tenant data leaking boundaries fail cleanly
SELECT throws_like(
    'SET LOCAL ROLE authenticated; SELECT * FROM visit_logs WHERE family_id = ''tenant-b-uuid'';',
    '%permission denied%',
    'Should structurally reject cross-tenant data reads'
);

SELECT * FROM finish();
ROLLBACK;
```

---

## 3. Claude Code Automated Diagnostics & Repair Playbook

When Claude Code is instructed to diagnose or fix pipeline errors, check code patterns in this exact sequence:

1. **Step 1: Check Security Framework Boundaries**
   If an endpoint throws a `500` error or access fails, run `supabase test db`. Ensure RLS policies explicitly allow service roles to append logs into `logging_audit.access_ledger` while completely restricting standard public accounts.
   
2. **Step 2: Inspect Frontend Accessibility Triggers**
   If an interaction element fails a Playwright integration run, evaluate the design tokens structure. Check that elements utilize `tokens.global.accessibility.touchTargetMinimum` values (`48px`) and pass screen-reader accessibility rules.

3. **Step 3: Webhook Verification Handling**
   If checkout callbacks result in unverified execution loops, trace variable configurations inside `process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET`. Ensure code blocks avoid falling back to unsafe, non-cryptographic bypass checks.

---

## 4. Claude Code Shortcuts & Prompts Guide
Use these explicit execution flags when interacting inline with Claude Code:
- `claude run-security-check` -> Executes database pgTAP testing modules and checks Next.js route structures for explicit token boundary checks.
- `claude generate-e2e-flow [FlowName]` -> Commands Claude to write complete Playwright script coverage tracking back to user story definitions.
- `claude repair-failing-tests` -> Scans Jest console errors and fixes schema mismatches, route validation gaps, or mock authentication failures.
