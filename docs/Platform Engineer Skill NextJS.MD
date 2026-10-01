---
name: caregiver-platform-nextjs-engineer
description: Guides AI agents in building secure, accessible, HIPAA/GDPR compliant web interfaces and server frameworks using Next.js, Tailwind CSS, and Supabase for regional caregiver orchestration.
---

# Next.js Caregiver Platform Engineering Guidelines

When writing, reviewing, or refactoring code for this Next.js caregiver web application, adhere strictly to the following framework architectures, compliance metrics, and safety rules.

## 1. Stack Foundations & Security Architectures
- **Next.js Pattern Enforcements:** Leverage the App Router directory structure (`app/`). Enforce React Server Components (RSC) for data fetching to isolate internal API keys, routing computation, and heavy medical payloads away from client browser visibility.
- **Strict PHI/PII Boundaries:** Never log or expose Protected Health Information (PHI) or Personally Identifiable Information (PII) in runtime console outputs, client-side tracking pixels, or non-encrypted telemetry streams (e.g., Vercel Logs, Sentry). 
- **Session State Rules:** Store authorization payloads exclusively inside secure, `httpOnly`, `SameSite=Lax`, encrypted cookies managed via Supabase Auth Helpers or `@supabase/ssr`. Never fallback to unencrypted `localStorage` for patient tokens.
- **Content Security Policy (CSP):** Enforce strict CSP headers via `middleware.ts` to block cross-site scripting (XSS) and code injection vectors into clinical grids.

## 2. HIPAA & GDPR Audit Logging Subsystems
Every record lifecycle event modifying patient or billing matrices must commit immutable tracking footprints directly inside the Supabase PostgreSQL ledger.

### Database Target Schema Configuration
```sql
-- Security Schema Isolation Layer
CREATE SCHEMA IF NOT EXISTS logging_audit;

CREATE TABLE logging_audit.access_ledger (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL,
    actor_role TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'INSERT' | 'SELECT' | 'UPDATE' | 'DELETE'
    target_table TEXT NOT NULL,
    record_checksum TEXT NOT NULL, -- SHA-256 hash of Row ID to eliminate raw health data exposure in logs
    ip_address_hash TEXT NOT NULL, -- Salted SHA-256 for GDPR compliance anonymity boundaries
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE logging_audit.access_ledger ENABLE ROW LEVEL SECURITY;
-- Lock down audit trails entirely. Only system service accounts can write; no client accounts can read/modify.
CREATE POLICY "Deny all public reads" ON logging_audit.access_ledger FOR SELECT TO authenticated USING (false);
```

### Next.js Server Action Enforcement Rule
Whenever creating data mutation pipelines inside Server Actions (`use server`), wrap execution flows with an explicit audit invocation block:
```typescript
import { createClient } from '@/utils/supabase/server';
import { createHash } from 'crypto';

interface AuditPayload {
  actorId: string;
  role: 'professional_caregiver' | 'family_member' | 'admin';
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  table: string;
  targetId: string;
  clientIp: string;
}

export async function commitAuditLog({ actorId, role, action, table, targetId, clientIp }: AuditPayload) {
  const supabase = await createClient(); // Service-role client bypasses standard RLS to commit logs safely
  
  const targetHash = createHash('sha256').update(targetId).digest('hex');
  const ipHash = createHash('sha256').update(clientIp + process.env.LOGGING_SALT).digest('hex');

  await supabase.from('access_ledger').insert({
    actor_id: actorId,
    actor_role: role,
    action_type: action,
    target_table: table,
    record_checksum: targetHash,
    ip_address_hash: ipHash
  });
}
```

## 3. High-Security Multi-Regional Payment Orchestration
The platform operates across varying international validation grids. Integrate payment pathways using strict server-side webhook validation rules.

### Regional Compliance Rules
1. **Africa Ecosystem (Hubtel for Ghana, Flutterwave for Nigeria/Kenya):** 
   - Never capture raw debit cards or mobile wallet credentials directly within the web layout.
   - Use hosted modal overlay patterns or handle tokens generated on client inputs using absolute payload sandboxing.
   - Mobile Money processing flows must issue explicit **Idempotency Keys** (`X-Idempotency-Key`) during client calls to prevent accidental double-billing during mobile browser network dropouts.
2. **Global Channels (Visa & PayPal):**
   - Leverage tokenization engines (e.g., Stripe Elements or PayPal SDK modules). 
   - Restrict local processing states from storing CVV/CVC numbers under any circumstance.

### Next.js API Route Webhook Validation Strategy (`app/api/webhooks/route.ts`)
```typescript
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

export async function POST(req: Request) {
  const payloadText = await req.text();
  const headerList = await headers();
  const signature = headerList.get('x-hubtel-signature') || headerList.get('verif-hash');

  // Cryptographic Signature Verification Handshake
  const computedHash = crypto
    .createHmac('sha256', process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET!)
    .update(payloadText)
    .digest('hex');

  if (signature !== computedHash) {
    return NextResponse.json({ error: 'Tampering Alert: Untrusted Signature Signature Handshake Failed' }, { status: 401 });
  }

  const data = JSON.parse(payloadText);
  // Proceed with backend execution pipelines (e.g., status changes inside Supabase)
  
  return NextResponse.json({ processed: true }, { status: 200 });
}
```

## 4. Automated Testing Matrix Configuration

### Backend Security Assertions (`supabase/tests/security_rls.test.sql`)
Verify database row privacy configurations prior to code builds via pgTAP testing suites:
```sql
BEGIN;
SELECT plan(3);

-- Test 1: Check that access_ledger is locked down
SELECT rls_enabled('logging_audit', 'access_ledger');

-- Test 2: Enforce that non-admin accounts cannot intercept care rosters
SELECT throws_like(
    \[SET LOCAL ROLE authenticated; SELECT * FROM profiles WHERE id = 'different-tenant-uuid'\]
,
    '%permission denied%',
    'Should structurally reject data parsing across cross-tenant partitions'
);

SELECT * FROM finish();
ROLLBACK;
```
*Run locally via terminal:* `supabase test db`

### Frontend View Testing Matrix (`__tests__/PrescriptionGrid.test.tsx`)
Enforce complete verification coverage rules on layout parameters using `@testing-library/react`.
```typescript
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrescriptionGrid from '@/components/PrescriptionGrid';

describe('Prescription Dashboard Layout Guardrails', () => {
  it('structurally hides patient clinical items if the user is unauthenticated', () => {
    const defaultMocks = { session: null, userRole: 'unauthenticated' };
    
    render(<PrescriptionGrid authContext={defaultMocks} data={[]} />);
    
    const medicalGrid = screen.queryByTestId('medication-dosage-table');
    expect(medicalGrid).not.toBeInTheDocument();
    
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
  });
});
```
*Run locally via terminal:* `npm run test`

## 5. Deployment Verification Protocols
- [ ] Are all Next.js API paths wrapping database transactions with explicit error catch triggers?
- [ ] Do all patient-facing input pages utilize Tailwind configurations that strictly enforce a minimum contrast score matching WCAG 2.1 AA parameters?
- [ ] Are all webhooks verifying external cryptographic validation signatures before executing profile metadata adjustments?
- [ ] Does your local terminal completely clear `supabase test db` regressions without failing any assertion parameters?
