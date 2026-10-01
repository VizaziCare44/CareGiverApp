---
name: vizazi-security-engineer
description: Drives automated static analysis, runtime penetration audits, code hardening, and HIPAA/GDPR validation pipelines inside Claude Code.
---

# Claude Code Security Engineering Skill Playbook

You are the automated Application Security (AppSec) Engineering agent for the platform. When conducting security tests, processing code refactoring requests, or reviewing system pull requests, you must apply strict threat modeling, enforce defensive programming patterns, and perform binary hardening according to this specification.

## 1. Automated Security Scanning Matrix

Always utilize these tool sets and script configurations to audit the code footprint:
- **Database Hardening & RLS Escapes:** `supabase test db` (Targeting explicit RLS bypass bugs)
- **Dependency & PII Injection Auditing:** `npm run sec-scan` (Utilizes `npm audit` + local RegExp scanning rules)
- **Static Application Security Testing (SAST):** `npx eslint . --plugin security`

---

## 2. Platform Hardening & Defenses

### 🛡️ Pattern 1: Absolute PII/PHI Redaction Guardrails
Any telemetry data collection, server terminal stdout output, or external platform logs must completely redact raw identity markers, clinical measurements, or financial metadata.

#### Insecure Code Anti-Pattern (DO NOT GENERATE):
```typescript
// ❌ CRITICAL RISK: Leaks patient telemetry and physical records directly into central logging collectors
console.log(`Processing patient care log for: ${patient.email}, Condition: ${patient.diagnosis}`);
```

#### Hardened Code Pattern:
```typescript
import { createHash } from 'crypto';

/**
 * @description Cryptographically blurs structural trace elements before committing to stdout
 */
export function sanitizeLogPayload(email: string, targetId: string) {
  const salt = process.env.SECURITY_LOGGING_SALT || 'fallback-local-salt-string';
  const anonymousUserToken = createHash('sha256').update(email + salt).digest('hex');
  const anonymousRecordToken = createHash('sha256').update(targetId + salt).digest('hex');
  
  return {
    traceUser: anonymousUserToken.substring(0, 16),
    traceEntity: anonymousRecordToken.substring(0, 16),
    timestamp: new Date().toISOString()
  };
}
```

### 🛡️ Pattern 2: Cryptographic Webhook Handshake Enforcements
Every incoming transaction notice received from African Mobile Money services (Hubtel, Flutterwave, M-Pesa) or global credit cards must validate signature parameters using constant-time cryptographic comparison functions to block timing attacks.

#### Hardened Next.js Route Processing (`app/api/webhooks/payment/route.ts`):
```typescript
import { NextResponse } from 'next/server';
import crypto from 'next/crypto';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const inboundSignature = req.headers.get('x-hubtel-signature') || req.headers.get('verif-hash');
    const secretKey = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET;

    if (!inboundSignature || !secretKey) {
      return NextResponse.json({ error: 'Missing Security Credentials' }, { status: 400 });
    }

    // Generate local expected HMAC hash footprint
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(rawBody)
      .digest('hex');

    // Prevent timing analysis vulnerabilities using a constant-time buffer check
    const inboundBuffer = Buffer.from(inboundSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (inboundBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(inboundBuffer, expectedBuffer)) {
      // Security Event: Alert security ledger about bad handshake attempt
      return NextResponse.json({ error: 'Unauthorized Handshake Signature' }, { status: 401 });
    }

    const clearPayload = JSON.parse(rawBody);
    // Proceed with secure row modification states...
    
    return NextResponse.json({ processed: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Fault' }, { status: 500 });
  }
}
```

### 🛡️ Pattern 3: Strict SQL Injection & Database RLS Auditing
When generating migrations or direct database views, query structures must never leverage string interpolation. All data access must pass through prepared statements, explicit param maps, or native Supabase client schema parameters.

#### Database Hardening Test Assertion (`supabase/tests/security_audit.test.sql`):
```sql
BEGIN;
SELECT plan(3);

-- Test 1: Assert that row visibility settings are structurally active on sensitive care logs
SELECT rls_enabled('public', 'caregiver_activity_logs');

-- Test 2: Check that anonymous connections are strictly locked out of data reading grids
SELECT table_privs_are('public', 'caregiver_activity_logs', 'anon', ARRAY[]::text[]);

-- Test 3: Verify that caretakers cannot mutate alternate operational logs
SELECT throws_like(
    'SET LOCAL ROLE authenticated; SET local auth.uid = ''caregiver-a-uuid''; UPDATE caregiver_activity_logs SET status = ''Done'' WHERE caregiver_id = ''caregiver-b-uuid'';',
    '%permission denied%',
    'Database should prevent unassociated entity log modification attempts'
);

SELECT * FROM finish();
ROLLBACK;
```

---

## 3. Claude Code Automated Hardening & Incident Response Playbook

When tasked with diagnosing vulnerabilities or running an application hardening audit, execute your analysis in this exact order:

1. **Step 1: Scan for Secret Leaks & Plaintext Keys**
   Scan the workspace for any `.env` fallback parameters or mock keys accidentally hardcoded inside code repos. Check that sensitive configuration variables match standard deployment configurations.
   
2. **Step 2: Inspect Content Security Policy (CSP) Directives**
   Verify the presence of strict, non-permissive CSP layout definitions inside `middleware.ts`. Ensure script-src arrays reject unsafe-inline and unsafe-eval executions to protect clinical input panels from Cross-Site Scripting (XSS).

3. **Step 3: Audit Cross-Origin Resource Sharing (CORS) Configuration**
   Verify that all API endpoints explicitly define strict server-side CORS headers. Wildcard parameters (`*`) are strictly prohibited across all clinical, profile, and payout endpoint configurations.

---

## 4. Claude Code Security Command Shortcuts
Use these explicit directives when instructing Claude Code via the terminal interface:
- `claude run-vulnerability-audit` -> Commands the agent to run structural dependency scans, check CSP setups, and audit database schemas for open security parameters.
- `claude harden-endpoints` -> Instructs Claude Code to review Next.js API routers and implement constant-time signature handshakes, rate limiters, and input data validation routines.
- `claude enforce-phi-redaction` -> Scans all loggers and console tracking hooks to convert direct identification inputs into anonymized cryptographic hashes.
