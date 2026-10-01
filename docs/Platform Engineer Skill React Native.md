---
name: caregiver-platform-engineer
description: Guides AI agents in building secure, accessible, and resilient features for caregiver platforms using React Native and Supabase, enforcing HIPAA/GDPR audit logs, automated security tests, and highly secure multi-regional payment integrations.
---

# Caregiver Platform Engineering Guidelines

When writing, reviewing, or refactoring code for this caregiver platform, adhere strictly to the following domain-specific standards, architectural patterns, and safety constraints.

## 1. Core Principles & Compliance
- **HIPAA & GDPR Compliance:** Never log or expose Protected Health Information (PHI) or Personally Identifiable Information (PII) in console logs, error trackers, or non-encrypted client states. Enforce GDPR data minimization principles.
- **Accessibility (a11y):** All UI components must meet WCAG 2.1 AA standards minimum (high contrast, keyboard navigation, explicit ARIA labels, and minimum 44x44px touch targets for mobile).
- **Offline Resilience:** Critical actions (medication logging, shift tracking) must support optimistic UI updates and local queue syncing using secure on-device persistence.

## 2. Platform Architecture & Stack Focus
- **Frontend:** React Native (Expo) optimized for touch targets, offline-first cache states, and secure cryptographic memory storage.
- **Backend:** Supabase (PostgreSQL) enforcing absolute schema separation, explicit Row-Level Security (RLS), and secure Edge Functions for external API traffic.

## 3. High-Security Multi-Regional Payments Architecture
When implementing or modifying payment systems across Africa (Flutterwave, Hubtel) and global markets (Visa/Stripe, PayPal):

### A. Infrastructure & Tokenization Rules
- **Zero Raw Cards/PII Stored:** Never transmit, parse, or store raw credit card numbers or mobile money PINs on client devices or the Supabase database. Use provider-specific SDKs (e.g., Flutterwave Inline, Hubtel API, PayPal Mobile SDKs) to fetch secure one-time payment tokens.
- **Webhook Handshake Verification:** Payment status updates must rely *only* on cryptographic server-side webhooks. 
  - Validate webhook signatures using provider secrets stored in Supabase Vault (`vault.secrets`).
  - Reject open webhook endpoints that lack signature headers or timestamp verifications.
- **Idempotency Execution:** Wrap all transaction processing logic in unique idempotency keys (`payment_intent_id` or unique order UUIDs) to prevent double-billing during mobile money connectivity drops common in emerging markets.

### B. Regional Routing Strategies
- **West & East Africa (Mobile Money/Cards):** 
  - Route Ghana transactions prioritizing **Hubtel** or **Flutterwave** Mobile Money rails (MTN, Telecel, AT).
  - Route Nigeria transactions via **Flutterwave** prioritizing bank transfers and card channels.
  - Route Kenya transactions via **Flutterwave** targeting MPESA merchant shortcodes.
- **Global Markets:** Route USD/EUR/GBP transactions directly through **Visa/Stripe** or **PayPal** APIs.
- **Failover Logic:** Implement clear switch-case handlers to fall back gracefully to secondary payment pipelines if a primary local aggregator experiences API timeouts.

```typescript
// Architectural Framework for Supabase Edge Function Webhook Handler
import { createClient } from '@supabase/supabase-js'

export async function verifyAndProcessPayment(req: Request) {
  const signature = req.headers.get('x-webhook-signature')
  if (!signature || !verifyCryptoSignature(signature, Deno.env.get('PAYMENT_WEBHOOK_SECRET'))) {
    return new Response('Unauthorized Handshake', { status: 401 })
  }

  const { tx_reference, status, amount, currency, metadata } = await req.json()
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Execute inside a single transactional database RPC to maintain consistency
  const { data, error } = await supabase.rpc('process_verified_transaction', {
    p_tx_ref: tx_reference,
    p_status: status,
    p_amount: amount,
    p_currency: currency,
    p_caregiver_id: metadata.caregiver_id
  })

  if (error) return new Response('DB Transaction Lock Failure', { status: 500 })
  return new Response('Success', { status: 200 })
}
```

## 4. HIPAA & GDPR Audit Logging Implementation
Every mutation impacting user accounts, medical logs, data exports, or financial records must write an irreversible, immutable record inside `audit.logs`.

### Supabase Database Architecture For Audits:
```sql
-- Isolate logging infrastructure to a non-public schema
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE audit.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    performed_at TIMESTAMPTZ DEFAULT clock_timestamp() NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'SELECT'
    target_table TEXT NOT NULL,
    record_id UUID NOT NULL,
    client_ip TEXT,
    old_data JSONB, -- Redact fields containing clinical data or financial details
    new_data JSONB
);

-- Deny all client mutations to audit schema via RLS
ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System write only" ON audit.logs FOR INSERT WITH CHECK (true);
CREATE POLICY "No modifications allowed" ON audit.logs FOR UPDATE OR DELETE USING (false);
```

### Automation Triggers for High-Risk Actions
Create auditing trigger functions that automatically strip out sensitive text fields (e.g., patient diagnoses, card tokens, medication names) to prevent logging plain-text health information, capturing *only* table schemas, actor identities, and modified record metadata IDs.

## 5. Automated Security Testing Strategy

### A. Backend Security Testing (Supabase CLI & pgTAP)
Catch Row-Level Security (RLS) leaks and broken object-level authorizations before deployment using database-native unit tests.

Create structural test profiles inside `supabase/tests/security_rls_test.sql`:
```sql
BEGIN;
SELECT plan(4);

-- Test 1: Confirm RLS is explicitly turned on across primary modules
SELECT rls_enabled('public', 'medical_records');
SELECT rls_enabled('public', 'transactions');

-- Test 2: Verify a Caregiver cannot query another Caregiver's client records
SELECT tests.authenticate_as('caregiver-user-uuid-1');
SELECT is_empty(
    $$ SELECT * FROM public.medical_records WHERE patient_id = 'patient-linked-to-caregiver-2' $$,
    'Caregiver must not leak cross-tenant patient records'
);

-- Test 3: Confirm audit logs block client modifications
SELECT throws_ok(
    $$ UPDATE audit.logs SET action_type = 'FRAUD' $$,
    '42501', -- Insufficient Privilege error code
    NULL,
    'Client accounts must be physically blocked from tampering with audit records'
);

SELECT * FROM finish();
ROLLBACK;
```
*Run tests locally using:* `supabase test db`

### B. Frontend Security Testing (React Native Testing Library)
Verify that unauthorized users are hard-blocked from seeing restricted financial metrics or sensitive patient charts within the application bundle.

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CaregiverDashboard } from '../screens/CaregiverDashboard';
import { AuthContext } from '../context/AuthContext';

describe('Caregiver UI Access Security Validation', () => {
  it('hides transactional billing and payment details for unauthorized unverified accounts', () => {
    const unverifiedSession = {
      user: { id: 'user-123', role: 'unverified_caregiver' },
      isAuthenticated: true
    };

    render(
      <AuthContext.Provider value={unverifiedSession}>
        <CaregiverDashboard />
      </AuthContext.Provider>
    );

    // Verify system explicitly hides internal payment grids from unverified actors
    const billingSection = screen.queryByTestId('wallet-balance-container');
    expect(billingSection).toBeNull();
  });
});
```
*Run tests using your local package configuration:* `npm run test` or `jest`

## 6. Verification Checklist
- [ ] Are all API connections to Flutterwave, Hubtel, and PayPal processed inside Supabase Edge Functions with verified signature hashes?
- [ ] Do all local mobile payment calls enforce an explicit server-side generated idempotency key?
- [ ] Are unit/integration tests running for permission edge cases (e.g., unverified caregiver access blocks)?
- [ ] Does the `audit.logs` trigger successfully sanitize text fields before archiving states?
- [ ] Is screen-reader support verified for dynamic payment screens and error warnings?