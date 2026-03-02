---
status: pending
priority: p2
issue_id: "008"
tags:
  - code-review
  - quality
  - type-safety
dependencies: []
---

# 008: Replace `any` Types in API Routes with Proper Types

## Problem Statement

All API routes use `any` type casts when reading KMS data, losing type safety. This allows:
- Invalid data structures to be returned
- Type mismatches to go undetected
- Editor autocomplete to fail
- Runtime errors in consuming code

**Why it matters:** TypeScript's entire value is type safety. Using `any` defeats this. The proper types already exist in `src/types.ts`.

**Locations:**
- `app/api/kms/decisions/route.ts` - Line 19: `const decisions: any[] = []`
- `app/api/kms/actions/route.ts` - Similar pattern
- `app/api/kms/risks/route.ts` - Similar pattern
- `app/api/kms/summary/route.ts` - Similar pattern
- `app/api/kms/relationships/route.ts` - Similar pattern

---

## Findings

**Current Code (Type-Unsafe):**
```typescript
export async function GET(request: NextRequest) {
  const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));

  // ← Using `any` loses type safety
  const decisions: any[] = [];
  Object.values(kmsData.meetings).forEach((meeting: any) => {
    if (meeting.decisions && Array.isArray(meeting.decisions)) {
      decisions.push(...meeting.decisions);
    }
  });

  return NextResponse.json(decisions);
}
```

**Problems:**
- `any` allows invalid data through
- Filtering logic must manually check types
- No autocomplete/IntelliSense
- Runtime errors possible

**Solution (Type-Safe):**
```typescript
import type { KMSStore, KMSDecision } from '@/src/types';

export async function GET(request: NextRequest) {
  const kmsData: KMSStore = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));

  // ← Strongly typed, compiler-checked
  const decisions: KMSDecision[] = [];
  Object.values(kmsData.meetings).forEach((meeting) => {
    if (meeting.decisions) {
      decisions.push(...meeting.decisions);
    }
  });

  return NextResponse.json(decisions);
}
```

---

## Proposed Solutions

### Solution 1: Use Imported Types from src/types.ts (RECOMMENDED)
**Effort:** 30 minutes | **Risk:** Low | **Type Safety:** Excellent

```typescript
// Import shared types
import type { KMSStore, KMSDecision, KMSActionItem, KMSRisk } from '@/src/types';

// Use in routes
const kmsData: KMSStore = JSON.parse(readFileSync(kmsPath, 'utf-8'));
const decisions: KMSDecision[] = [];
```

**Pros:**
- Single source of truth (types already defined)
- Zero type casts needed
- Full TypeScript support
- Minimal code change

---

### Solution 2: Define Types in app/types.ts
**Effort:** 1 hour | **Risk:** Medium | **Duplication:** Bad

Define duplicate types in app layer.

**Cons:**
- Duplicates existing types
- Risk of divergence
- Maintenance burden

---

### Solution 3: Add Runtime Validation with Zod
**Effort:** 2 hours | **Risk:** Low | **Validation:** Good

Use Zod for both type safety and runtime validation.

```typescript
import { z } from 'zod';

const KMSStoreSchema = z.object({
  meetings: z.record(z.object({
    decisions: z.array(/* ... */).optional(),
  })),
});

const kmsData = KMSStoreSchema.parse(
  JSON.parse(fs.readFileSync(kmsPath, 'utf-8'))
);
```

**Pros:**
- Runtime validation
- Type inference

**Cons:**
- Additional dependency
- More verbose

---

## Recommended Action

**Implement Solution 1 (Import Existing Types)** - Simplest and most direct fix.

---

## Technical Details

**Import Statement:**
```typescript
// At top of each route file
import type {
  KMSStore,
  KMSDecision,
  KMSActionItem,
  KMSRisk,
  KMSCommitment
} from '@/src/types';
```

**Type Annotations:**
```typescript
// Before
const kmsData = JSON.parse(...);

// After
const kmsData: KMSStore = JSON.parse(...);
```

**Benefits After Fix:**
```typescript
// ✅ Autocomplete now works
decisions.filter(d => d.status === 'pending')

// ✅ Compiler catches type errors
decisions.filter(d => d.nonexistent)  // Error!

// ✅ No manual type checking needed
decisions.forEach(d => {
  console.log(d.title);  // TypeScript knows this property
});
```

**Files to Modify:**
- `app/api/kms/decisions/route.ts`
- `app/api/kms/actions/route.ts`
- `app/api/kms/risks/route.ts`
- `app/api/kms/summary/route.ts`
- `app/api/kms/relationships/route.ts`
- `app/api/kms/validate/route.ts`

---

## Acceptance Criteria

- [ ] All 6 API routes import types from `@/src/types`
- [ ] No `any` type used in route handlers
- [ ] KMSStore type used for parsed JSON
- [ ] Specific decision/action/risk types used for arrays
- [ ] TypeScript compiler passes with zero errors
- [ ] All existing tests still pass
- [ ] Autocomplete works in VS Code
- [ ] No runtime errors from type changes
- [ ] Code review confirms type correctness

---

## Work Log

- [ ] **Phase 1 (15m):** Update imports in all 6 routes
- [ ] **Phase 2 (15m):** Replace `any` with proper types
- [ ] **Phase 3 (10m):** Verify TypeScript compilation
- [ ] **Phase 4 (10m):** Run tests

---

## Resources

- [TypeScript Import Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports)
- [Type Safety Best Practices](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Project types.ts](./../../transcript-analyzer-unified/src/types.ts)

---

## Related Todos

- `002-pending-p1-security-json-injection.md` - Input validation (complements this)
- `009-pending-p2-perf-duplicate-reads.md` - Related code improvements
