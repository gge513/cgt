---
status: pending
priority: p1
issue_id: "002"
tags:
  - code-review
  - security
  - injection
  - critical
dependencies:
  - "001"
---

# 002: Fix JSON Injection Vulnerability in `/api/kms/validate`

## Problem Statement

The `validate/route.ts` endpoint accepts user input and writes it directly to disk without sanitization or validation. An attacker can:
- Inject malicious JSON into the KMS database
- Corrupt all stored data
- Create invalid relationship records
- Execute arbitrary modifications to decisions and actions

**Why it matters:** This allows data corruption attacks and could compromise all KMS data integrity.

**Location:** `app/api/kms/validate/route.ts`

---

## Findings

**Current Vulnerable Code:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();  // ← No validation

    // Directly writes to disk without checking structure
    const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));

    // ← Unsanitized user data written to file
    fs.writeFileSync(kmsPath, JSON.stringify(kmsData, null, 2), 'utf-8');
```

**Attack Example:**
```bash
curl -X POST http://localhost:3000/api/kms/validate \
  -H "Content-Type: application/json" \
  -d '{
    "relationshipId": "'; DROP TABLE decisions; --",
    "isValid": true
  }'
```

**Severity:** 🔴 CRITICAL - Data corruption vulnerability

**OWASP Category:** A03:2021 – Injection

---

## Proposed Solutions

### Solution 1: Input Validation with Zod (RECOMMENDED)
**Effort:** 2-3 hours | **Risk:** Low | **Type Safety:** Excellent

```typescript
import { z } from 'zod';

const ValidateRequestSchema = z.object({
  relationshipId: z.string().uuid(),  // Only valid UUIDs
  isValid: z.boolean(),
});

const InferredRelationshipSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  fromType: z.enum(['decision', 'action', 'commitment', 'risk']),
  toType: z.enum(['decision', 'action', 'commitment', 'risk']),
  relationshipType: z.enum(['blocks', 'impacts', 'depends_on', 'related_to']),
  confidence: z.number().min(0).max(1),
  validated: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate against schema - throws if invalid
    const validated = ValidateRequestSchema.parse(body);

    // Now we know validated.relationshipId is a valid UUID
    // Proceed with database update...
```

**Pros:**
- Type-safe validation
- Clear error messages
- Prevents invalid data
- Works with existing types

**Cons:**
- New dependency (zod)
- Slight performance overhead

---

### Solution 2: Manual Type Guards (LIGHTWEIGHT)
**Effort:** 1-2 hours | **Risk:** Medium | **Complexity:** Higher

```typescript
function validateRelationshipInput(data: unknown): ValidateRequest {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid request body');
  }

  const obj = data as Record<string, unknown>;

  // Validate relationshipId is UUID format
  if (typeof obj.relationshipId !== 'string' || !isValidUUID(obj.relationshipId)) {
    throw new Error('relationshipId must be a valid UUID');
  }

  if (typeof obj.isValid !== 'boolean') {
    throw new Error('isValid must be boolean');
  }

  return {
    relationshipId: obj.relationshipId,
    isValid: obj.isValid,
  };
}

export async function POST(request: NextRequest) {
  const validated = validateRelationshipInput(await request.json());
  // Safe to use validated now
}
```

**Pros:**
- No new dependencies
- Lightweight
- Direct control

**Cons:**
- More verbose
- Error prone
- Type safety not guaranteed

---

### Solution 3: TypeScript `satisfies` Operator (MODERN)
**Effort:** 1 hour | **Risk:** Low | **Type Safety:** Good

```typescript
type ValidateRequest = {
  relationshipId: string & { readonly __brand: 'UUID' };
  isValid: boolean;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) satisfies ValidateRequest;

  // Type check at compile time, but no runtime validation
  if (!isValidUUID(body.relationshipId)) {
    return NextResponse.json(
      { error: 'Invalid relationshipId format' },
      { status: 400 }
    );
  }
```

**Pros:**
- No runtime overhead
- Type-safe
- Modern TypeScript

**Cons:**
- No runtime validation
- Still need manual checks

---

## Recommended Action

**Implement Solution 1 (Zod Validation)** - Best balance of safety, maintainability, and type safety.

---

## Technical Details

**Install Zod:**
```bash
npm install zod
```

**Create validation file:**
`lib/validation.ts` - Centralize all API request schemas

**Files to Modify:**
- `app/api/kms/validate/route.ts`
- All other API routes (apply same validation pattern)

**Schema Coverage:**
- Validate all POST/PUT request bodies
- Validate query parameters
- Validate path parameters (UUIDs, etc.)

---

## Acceptance Criteria

- [ ] Zod installed and imported
- [ ] ValidateRequest schema defined and tested
- [ ] POST handler uses schema validation
- [ ] Invalid UUID format rejected with 400
- [ ] Invalid boolean rejected with 400
- [ ] All error messages are descriptive
- [ ] KMS data validation prevents corruption
- [ ] Unit tests verify rejection of invalid input
- [ ] Integration test: valid input accepted, invalid rejected

---

## Work Log

- [ ] **Phase 1 (1h):** Install Zod and create schema
- [ ] **Phase 2 (1h):** Update validate endpoint handler
- [ ] **Phase 3 (1h):** Write tests for valid/invalid inputs
- [ ] **Phase 4 (30m):** Apply to other API endpoints

---

## Resources

- [Zod Documentation](https://zod.dev/)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [Security Audit Report - JSON Injection](./../../SECURITY_AUDIT_REPORT.md#5-json-injection-vulnerability)
- Related: `001-pending-p1-security-auth-missing.md`

---

## Related Todos

- `001-pending-p1-security-auth-missing.md` - Add authentication
- `003-pending-p1-security-path-traversal.md` - Path traversal fixes
