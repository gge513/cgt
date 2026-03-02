---
status: complete
priority: p2
issue_id: "009"
tags:
  - code-review
  - architecture
  - refactoring
dependencies: []
---

# 009: Create KMS Data Abstraction Layer for API Routes

## Problem Statement

All 5 API routes directly read/write files using `fs` operations. This creates:
- Code duplication (same file reading pattern repeated)
- Tight coupling to filesystem
- Difficult to test (mocking fs required)
- Hard to add caching (duplicated in each route)
- Impossible to change storage without modifying all routes

**Why it matters:** Moving to a database or adding caching requires changing 5+ places. Abstraction prevents this.

**Current Pattern (Duplicated 5 Times):**
```typescript
const kmsPath = path.join(process.cwd(), '.processed_kms.json');
const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));
```

---

## Findings

**Duplication Count:**
- File path construction: 5 times
- JSON parsing: 5 times
- Error handling: 5 times
- Meeting aggregation: 5 times

**Routes Affected:**
- `app/api/kms/decisions/route.ts`
- `app/api/kms/actions/route.ts`
- `app/api/kms/risks/route.ts`
- `app/api/kms/summary/route.ts`
- `app/api/kms/relationships/route.ts`

**Maintenance Cost:** Every new KMS feature requires updating 5 places.

---

## Proposed Solutions

### Solution 1: KMSFileStore Abstraction (RECOMMENDED)
**Effort:** 2-3 hours | **Risk:** Low | **Reusability:** Excellent

Create single interface for all KMS data access.

```typescript
// lib/kms/store.ts
import { readFileSync, writeFileSync } from 'fs';
import type { KMSStore } from '@/src/types';

export interface IKMSStore {
  loadData(): Promise<KMSStore>;
  saveData(data: KMSStore): Promise<void>;
  getDecisions(): Promise<any[]>;
  getActions(): Promise<any[]>;
  getRisks(): Promise<any[]>;
}

export class KMSFileStore implements IKMSStore {
  private dataPath: string;

  constructor(basePath = process.cwd()) {
    this.dataPath = path.join(basePath, '.processed_kms.json');
  }

  async loadData(): Promise<KMSStore> {
    try {
      const content = readFileSync(this.dataPath, 'utf-8');
      return JSON.parse(content) as KMSStore;
    } catch (error) {
      throw new Error(`Failed to load KMS data: ${error}`);
    }
  }

  async saveData(data: KMSStore): Promise<void> {
    try {
      writeFileSync(
        this.dataPath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Failed to save KMS data: ${error}`);
    }
  }

  async getDecisions() {
    const data = await this.loadData();
    const decisions: any[] = [];

    Object.values(data.meetings || {}).forEach((meeting: any) => {
      if (meeting.decisions) {
        decisions.push(...meeting.decisions);
      }
    });

    return decisions;
  }

  async getActions() {
    const data = await this.loadData();
    const actions: any[] = [];

    Object.values(data.meetings || {}).forEach((meeting: any) => {
      if (meeting.actionItems) {
        actions.push(...meeting.actionItems);
      }
    });

    return actions;
  }

  async getRisks() {
    const data = await this.loadData();
    const risks: any[] = [];

    Object.values(data.meetings || {}).forEach((meeting: any) => {
      if (meeting.risks) {
        risks.push(...meeting.risks);
      }
    });

    return risks;
  }
}

// Singleton instance
let store: IKMSStore | null = null;

export function getKMSStore(): IKMSStore {
  if (!store) {
    store = new KMSFileStore();
  }
  return store;
}
```

**Usage in Routes:**
```typescript
// Before (duplicated logic in every route)
const kmsPath = path.join(process.cwd(), '.processed_kms.json');
const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));
const decisions = Object.values(kmsData.meetings || {}).flatMap(m => m.decisions || []);

// After (single line, reusable)
const store = getKMSStore();
const decisions = await store.getDecisions();
```

**Pros:**
- Single responsibility (one class for data access)
- Testable (can mock IKMSStore)
- Cacheable (can wrap with cache layer)
- Swappable (can implement other stores)
- No duplication

**Cons:**
- Slight indirection
- One more abstraction level

---

### Solution 2: Dependency Injection Pattern
**Effort:** 3-4 hours | **Risk:** Medium | **Flexibility:** Excellent

Use IoC container for dependency injection.

```typescript
// lib/container.ts
import { createContainer } from 'inversify';
import { IKMSStore, KMSFileStore } from './kms/store';

const container = createContainer();

container.bind<IKMSStore>('KMSStore').to(KMSFileStore).inSingletonScope();

export function getStore(): IKMSStore {
  return container.get<IKMSStore>('KMSStore');
}
```

**Pros:**
- Highly testable
- Full dependency control
- Supports multiple implementations

**Cons:**
- More complex
- Requires container setup
- More boilerplate

---

### Solution 3: Factory Pattern
**Effort:** 1-2 hours | **Risk:** Low | **Simplicity:** Good

Simple factory function for store creation.

```typescript
// lib/kms/factory.ts
export function createKMSStore(type: 'file' | 'database' = 'file'): IKMSStore {
  if (type === 'file') {
    return new KMSFileStore();
  } else if (type === 'database') {
    return new KMSDatabaseStore();
  }
  throw new Error(`Unknown store type: ${type}`);
}
```

**Pros:**
- Simple and clear
- Easy to add new implementations
- Good for testing

**Cons:**
- Less powerful than DI
- Factory logic grows with implementations

---

## Recommended Action

**Implement Solution 1 (KMSFileStore Abstraction)** - Best balance of simplicity and flexibility.

---

## Technical Details

**File Structure:**
```
lib/
  kms/
    store.ts          # IKMSStore interface and KMSFileStore
    index.ts          # Re-exports
```

**New Type:**
```typescript
interface IKMSStore {
  loadData(): Promise<KMSStore>;
  saveData(data: KMSStore): Promise<void>;
  getDecisions(filter?: FilterOptions): Promise<any[]>;
  getActions(filter?: FilterOptions): Promise<any[]>;
  getRisks(filter?: FilterOptions): Promise<any[]>;
}
```

**Migration Path:**

1. Create `lib/kms/store.ts` with interface
2. Create `KMSFileStore` implementation
3. Update `app/api/kms/decisions/route.ts` to use store
4. Update remaining routes one by one
5. Add caching decorator to store (optional)

**Files to Create:**
- `lib/kms/store.ts` - Store abstraction
- `lib/kms/index.ts` - Exports

**Files to Modify:**
- All 5 API route files (reduce from 20 lines → 5 lines each)

---

## Acceptance Criteria

- [ ] IKMSStore interface created
- [ ] KMSFileStore implementation complete
- [ ] Singleton pattern for store instance
- [ ] All 5 routes use `getKMSStore()`
- [ ] No `fs` imports in route files
- [ ] Aggregation logic in store, not routes
- [ ] Error handling consistent
- [ ] Type safety maintained
- [ ] All tests pass
- [ ] Code duplication eliminated

---

## Benefits After Implementation

**Duplication Eliminated:**
```
Before:  20 lines × 5 routes = 100 lines
After:   5 lines × 5 routes = 25 lines
Saved:   75 lines of duplicated code
```

**Now Easy to Add:**
- Response caching
- Database storage
- Mock for testing
- Metrics/logging
- Filtering options

**Example: Adding Cache Layer**
```typescript
// lib/kms/cached-store.ts
export class CachedKMSStore implements IKMSStore {
  constructor(private delegate: IKMSStore) {}

  async getDecisions() {
    const cached = cache.get('decisions');
    if (cached) return cached;

    const decisions = await this.delegate.getDecisions();
    cache.set('decisions', decisions, 30 * 1000);
    return decisions;
  }
}

// Usage
const store = new CachedKMSStore(new KMSFileStore());
```

---

## Work Log

- [ ] **Phase 1 (1h):** Create store interface and implementation
- [ ] **Phase 2 (1h):** Update all 5 API routes
- [ ] **Phase 3 (30m):** Test and verify
- [ ] **Phase 4 (30m):** Add integration tests

---

## Resources

- [Dependency Injection Pattern](https://en.wikipedia.org/wiki/Dependency_injection)
- [SOLID Principles - Single Responsibility](https://en.wikipedia.org/wiki/SOLID)
- [TypeScript Interfaces](https://www.typescriptlang.org/docs/handbook/2/objects.html)
- [Architecture Analysis Report](./../../ARCHITECTURE_ANALYSIS.md#critical-issues)

---

## Related Todos

- `007-pending-p2-perf-api-caching.md` - Caching (uses this abstraction)
- `008-pending-p2-code-any-types.md` - Type safety (applies here too)
- `001-pending-p1-security-auth-missing.md` - Security (can protect in one place)
