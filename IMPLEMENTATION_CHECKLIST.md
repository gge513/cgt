# KMS Dashboard Fixes - Implementation Checklist

This checklist guides developers through implementing the code review fixes.

---

## Preparation (15 minutes)

- [ ] Read `REVIEW_SUMMARY.md` for overview
- [ ] Read `REVIEW_KMS_DASHBOARD.md` for detailed issues
- [ ] Have `FIXING_CRITICAL_ISSUES.md` open for code examples
- [ ] Ensure working TypeScript setup: `npm run build` should work
- [ ] Current branch: `main` or feature branch?

---

## Phase 1: Critical Fixes (MUST DO FIRST)

### Step 1: Create API Type Contracts (1 hour)

**File:** Create new `app/api/kms/types.ts`

- [ ] Create `KMSSummaryResponse` interface
- [ ] Create `KMSDecisionsResponse` interface
- [ ] Create `KMSActionsResponse` interface
- [ ] Create `KMSRelationshipsResponse` interface
- [ ] Create `KMSValidationResponse` interface
- [ ] Create `APIErrorResponse` interface (shared across all routes)
- [ ] Verify interfaces compile: `npm run build`

**Checklist per interface:**
- [ ] All properties have explicit types (no `any`)
- [ ] Use proper imports from `@/src/types`
- [ ] Document purpose with JSDoc comments

---

### Step 2: Fix Relationship Inference Validation (1 hour)

**File:** `src/kms/relationshipInferencerDSPy.ts`

**Lines 1-50: Add type guards**
- [ ] Create `VALID_ITEM_TYPES` constant array
- [ ] Create `VALID_RELATIONSHIP_TYPES` constant array
- [ ] Create `isValidItemType()` type guard function
- [ ] Create `isValidRelationshipType()` type guard function
- [ ] Create `ValidatedRelationship` interface
- [ ] Verify new code compiles

**Lines 102-165: Fix parseRelationship function**
- [ ] Validate union types BEFORE using them
- [ ] Remove all `as any` type assertions
- [ ] Add proper type narrowing in return statement
- [ ] Improve logging with context information
- [ ] Test: `npm run test -- relationshipInferencerDSPy`

**Verification:**
```bash
# Should have 0 "as any" in this file
grep "as any" src/kms/relationshipInferencerDSPy.ts
# Should return nothing
```

---

### Step 3: Fix API Routes - Remove `any` Types (2 hours)

**File 1:** `app/api/kms/summary/route.ts`

- [ ] Import `KMSStore` from `@/src/types`
- [ ] Import response types from `./types`
- [ ] Replace `const kmsData = JSON.parse(...)` with proper typed assignment
- [ ] Type `kmsStore: KMSStore` explicitly
- [ ] Create `safeDivide()` helper function
- [ ] Use `KMSSummaryResponse` type for return object
- [ ] Remove all `any` type annotations
- [ ] Update error handling to return `APIErrorResponse`
- [ ] Test: `npm run build`

**Checklist per section:**
- [ ] Decisions array properly typed as `KMSDecision[]`
- [ ] Safe division for percentage calculation
- [ ] Response construction matches interface

---

**File 2:** `app/api/kms/decisions/route.ts`

- [ ] Import `KMSStore, KMSDecision` from `@/src/types`
- [ ] Import response types from `./types`
- [ ] Type `kmsStore: KMSStore` explicitly
- [ ] Type `decisions: KMSDecision[]`
- [ ] Validate `status` parameter against allowed values
- [ ] Validate `severity` parameter if present
- [ ] Use type guards (`is`) for filtering
- [ ] Use `KMSDecisionsResponse` for return
- [ ] Test: `npm run build && npm run test`

**Before/After check:**
```typescript
// ❌ Before
const decisions: any[] = [];

// ✅ After
const decisions: KMSDecision[] = [];
```

---

**File 3:** `app/api/kms/relationships/route.ts`

- [ ] Import proper types
- [ ] Type relationship filtering with proper interfaces
- [ ] Remove `any` type references
- [ ] Use `KMSRelationshipsResponse`
- [ ] Test: `npm run build`

---

**File 4:** `app/api/kms/actions/route.ts`

- [ ] Type action objects properly
- [ ] Use `KMSActionsResponse` interface
- [ ] Validate action type against allowed values
- [ ] Test: `npm run build`

---

**File 5:** `app/api/kms/validate/route.ts`

- [ ] Use `KMSValidationResponse` interface
- [ ] Proper type annotations throughout
- [ ] Test: `npm run build`

---

### Step 4: Verify Critical Fixes (30 minutes)

**TypeScript compilation:**
```bash
npm run build
# Should show: "Type checking: 0 errors"
```

**Check for remaining `any` types:**
```bash
grep -r "as any" app/api/kms
grep -r ": any" app/api/kms
# Should return nothing
```

**Run tests:**
```bash
npm run test
# Should pass all tests
```

---

## Phase 2: High Priority Fixes (4-5 hours)

### Step 5: Create Typed Query Hook (1 hour)

**File:** Create new `app/hooks/useKmsSummary.ts`

- [ ] Import `useQuery` from React Query
- [ ] Import `KMSSummaryResponse` from API types
- [ ] Create `UseKmsSummaryOptions` interface
- [ ] Export `useKmsSummary()` function
- [ ] Add proper error handling in fetch
- [ ] Add optional runtime validation (zod if available)
- [ ] Add JSDoc comments
- [ ] Test: `npm run build`

**Key elements:**
- [ ] Proper generic types for useQuery
- [ ] Error response handling
- [ ] Cache configuration (staleTime, gcTime)

---

### Step 6: Update Dashboard to Use Hook (45 minutes)

**File:** `app/dashboard/page.tsx`

- [ ] Import `useKmsSummary` hook
- [ ] Replace old useQuery with hook
- [ ] Remove manual default values (hook handles them)
- [ ] Type `data` properly from hook
- [ ] Ensure null safety with type narrowing
- [ ] Test: `npm run build && npm run test`

**Verification:**
```typescript
// Should compile without errors
const { data, isLoading, error } = useKmsSummary();

// data should be properly typed
const { summary, status_distribution } = data; // No type errors
```

---

### Step 7: Abstract File System Access (1.5-2 hours)

**File:** Create new `lib/kmsStoreProvider.ts`

- [ ] Create `KMSStoreProvider` interface
- [ ] Implement `FileSystemKMSStore` class
- [ ] Add error handling for file operations
- [ ] Export both interface and implementation
- [ ] Test: `npm run build`

**File:** Update API routes to use provider

For each route (`decisions`, `summary`, `relationships`, `actions`, `validate`):
- [ ] Create instance of `FileSystemKMSStore`
- [ ] Use `provider.getStore()` instead of direct fs calls
- [ ] Proper error handling
- [ ] Test: `npm run build`

---

### Step 8: Improve Error Handling (1 hour)

**File:** Create new `lib/apiErrors.ts`

- [ ] Create `ValidationError` class
- [ ] Create `NotFoundError` class
- [ ] Create `handleAPIError()` function
- [ ] Export all for use in routes
- [ ] Test: `npm run build`

**Update each API route:**
- [ ] Throw `ValidationError` for validation failures
- [ ] Throw `NotFoundError` when data not found
- [ ] Use `handleAPIError()` in catch block
- [ ] Don't leak error details to client

---

## Phase 3: Medium Priority Fixes (2-3 hours)

### Step 9: Fix KMS Store Search Types (45 minutes)

**File:** `src/kms/store.ts`

- [ ] Create `KMSSearchResult` discriminated union type
- [ ] Update `search()` method signature
- [ ] Return `KMSSearchResult[]` instead of `any[]`
- [ ] Update all search usages
- [ ] Test: `npm run build && npm run test`

---

### Step 10: Extract API Route Utilities (1 hour)

**File:** Create new `app/api/kms/utils.ts`

- [ ] Create `loadKMSStore()` helper
- [ ] Create `saveKMSStore()` helper
- [ ] Add error handling
- [ ] Export for all routes to use

**Update routes:**
- [ ] Replace `fs.readFileSync` calls with helper
- [ ] Remove duplication across routes

---

### Step 11: Fix Charts Component Types (30 minutes)

**File:** `app/dashboard/components/Charts.tsx`

- [ ] Create `getStatusColor()` function
- [ ] Use proper type narrowing instead of `as` assertion
- [ ] Fix unsafe array indexing
- [ ] Test: `npm run build`

---

## Testing Throughout

### After Each Phase:

```bash
# Build check
npm run build

# Lint check (if available)
npm run lint

# Run tests
npm run test

# Type check with strict mode (if available)
npm run type-check
```

### Create Tests for New Code:

- [ ] Test each API route with mocked data
- [ ] Test error scenarios
- [ ] Test useKmsSummary hook
- [ ] Test type guards in relationship parser

**Example test:**
```typescript
describe('GET /api/kms/decisions', () => {
  test('should return KMSDecisionsResponse with correct shape', async () => {
    const response = await GET(mockRequest);
    const data: KMSDecisionsResponse = await response.json();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('filtered');
    expect(Array.isArray(data.decisions)).toBe(true);
  });
});
```

---

## Code Review Checklist

Before submitting for review, verify:

### Type Safety
- [ ] No `any` types remaining (except where documented)
- [ ] All functions have explicit return types
- [ ] All parameters have types
- [ ] No loose type assertions (`as`) used incorrectly

### Error Handling
- [ ] All throw statements use custom error classes
- [ ] All catch blocks handle specific error types
- [ ] No error details leaked to client
- [ ] Proper HTTP status codes (400, 404, 500)

### Testing
- [ ] All critical paths have tests
- [ ] Edge cases tested
- [ ] Error scenarios tested
- [ ] Mocks properly configured

### Documentation
- [ ] JSDoc comments on functions
- [ ] API response types documented
- [ ] Error types documented
- [ ] Breaking changes noted (if any)

### Code Quality
- [ ] No duplicated code across routes
- [ ] Consistent naming conventions
- [ ] Proper imports and exports
- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm run test`

---

## Final Verification

Before considering fixes complete:

```bash
# 1. Full build
npm run build
# Expected: "Type checking: 0 errors"

# 2. All tests
npm run test
# Expected: "All tests passed"

# 3. No `any` types in critical files
grep -r "any" app/api/kms src/kms --include="*.ts" | grep -v "any\[\]" | grep -v "any)"
# Expected: Minimal matches, all documented

# 4. Manual API testing
curl http://localhost:3000/api/kms/summary | jq '.'
# Expected: Valid JSON with proper structure

# 5. Dashboard works
# Manual test in browser - should load and display data
```

---

## Troubleshooting

### Issue: Build fails with "Property 'X' does not exist on type 'Y'"

**Solution:** Check your type import
```bash
# Verify type is exported from src/types.ts
grep "export interface Y" src/types.ts

# Update import if needed
import { Y } from '@/src/types';
```

### Issue: TypeScript complains about undefined properties

**Solution:** Use proper null checking
```typescript
// ❌ Wrong
const value = obj.property;

// ✅ Right
const value = obj?.property;

// ✅ Or with type guard
if (obj.property) {
  const value = obj.property;
}
```

### Issue: Test fails with mock data

**Solution:** Ensure mock data matches type
```typescript
const mockData: KMSStore = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  meetings: {
    'test-meeting': {
      meeting: 'test-meeting',
      analyzedAt: new Date().toISOString(),
      date: '2026-03-02',
      model: 'claude-haiku',
      decisions: [], // Ensure this is array
      actionItems: [],
      commitments: [],
      risks: [],
    },
  },
};
```

---

## Time Estimates

| Phase | Component | Time | Priority |
|-------|-----------|------|----------|
| 1 | Type Contracts | 1h | CRITICAL |
| 1 | Relationship Validation | 1h | CRITICAL |
| 1 | API Route Fixes | 2h | CRITICAL |
| 1 | Verification | 0.5h | CRITICAL |
| **Phase 1 Total** | | **4.5h** | **CRITICAL** |
| 2 | Query Hook | 1h | HIGH |
| 2 | Dashboard Update | 0.75h | HIGH |
| 2 | File System Abstraction | 2h | HIGH |
| 2 | Error Handling | 1h | HIGH |
| **Phase 2 Total** | | **4.75h** | **HIGH** |
| 3 | Store Search Types | 0.75h | MEDIUM |
| 3 | Route Utilities | 1h | MEDIUM |
| 3 | Charts Fix | 0.5h | MEDIUM |
| **Phase 3 Total** | | **2.25h** | **MEDIUM** |
| | **GRAND TOTAL** | **11.5h** | |

---

## Git Workflow

Recommended commit sequence:

```bash
# 1. Type contracts
git commit -m "feat(kms): Add API response type contracts"

# 2. Relationship validation
git commit -m "fix(kms): Add discriminated union validation"

# 3. API fixes
git commit -m "fix(api): Remove any types and add type safety"

# 4. Query hook
git commit -m "feat(dashboard): Create useKmsSummary hook"

# 5. Dashboard update
git commit -m "refactor(dashboard): Use typed query hook"

# 6. File system abstraction
git commit -m "refactor(api): Abstract file system access"

# 7. Error handling
git commit -m "feat(api): Improve error handling and validation"

# 8. Medium priority
git commit -m "refactor: Clean up types and extract utilities"

# Then create PR for review
```

---

## Sign-Off

Once all phases are complete, the developer should:

- [ ] All items in this checklist completed
- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Created pull request
- [ ] Requested review from team
- [ ] Document any deviations from this plan

**Completed by:** ________________
**Date:** ________________
**Time spent:** ________________
**Notes:** ________________

