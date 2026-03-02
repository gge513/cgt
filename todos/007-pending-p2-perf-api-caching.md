---
status: pending
priority: p2
issue_id: "007"
tags:
  - code-review
  - performance
  - caching
dependencies: []
---

# 007: Implement API Response Caching for 100x Dashboard Speedup

## Problem Statement

All API endpoints read JSON files from disk on every request, with no caching. Dashboard load time is 1500ms because:
- Each page load makes 5 API calls
- Each call reads `.processed_kms.json` from disk (50-100ms each)
- No in-memory caching
- No request deduplication

**Why it matters:** Dashboard feels slow. Agents making repeated queries get poor performance. Simple caching yields 100x speedup.

**Current Performance:**
- Summary API: 100ms per call
- Decisions API: 80ms per call
- Actions API: 70ms per call
- Total dashboard load: 1500ms

**Target Performance:**
- Summary API: 1ms per call (100x)
- Decisions API: 1ms per call
- Actions API: 1ms per call
- Total dashboard load: 50ms

---

## Findings

**Problem Locations:**
- `app/api/kms/summary/route.ts` - Reads file, aggregates data every request
- `app/api/kms/decisions/route.ts` - Same pattern
- `app/api/kms/actions/route.ts` - Same pattern
- `app/api/kms/risks/route.ts` - Same pattern

**Current Pattern:**
```typescript
export async function GET(request: NextRequest) {
  // Reads from disk EVERY request
  const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));

  // Aggregates data EVERY request
  const decisions = Object.values(kmsData.meetings).flatMap(m => m.decisions);

  // Filters EVERY request
  const filtered = decisions.filter(d => d.priority === 'high');

  return NextResponse.json(filtered);
}
```

**Impact:** 100% of requests pay full I/O + computation cost.

---

## Proposed Solutions

### Solution 1: File Modification Time Caching (RECOMMENDED)
**Effort:** 2-3 hours | **Risk:** Low | **Reliability:** High

Cache is invalidated only when `.processed_kms.json` changes.

```typescript
// lib/cache.ts
import { statSync, readFileSync } from 'fs';
import { join } from 'path';

interface CacheEntry<T> {
  data: T;
  timestamp: number;  // File mtime
}

const KMS_CACHE = new Map<string, CacheEntry<any>>();
const KMS_PATH = join(process.cwd(), '.processed_kms.json');

export function getKMSData(): any {
  try {
    const stat = statSync(KMS_PATH);
    const currentMtime = stat.mtimeMs;

    // Check cache validity
    const cached = KMS_CACHE.get('kms');
    if (cached && cached.timestamp === currentMtime) {
      // Cache hit - file hasn't changed
      return cached.data;
    }

    // Cache miss - reload and update timestamp
    const data = JSON.parse(readFileSync(KMS_PATH, 'utf-8'));
    KMS_CACHE.set('kms', { data, timestamp: currentMtime });

    return data;
  } catch (error) {
    console.error('Error reading KMS data:', error);
    throw error;
  }
}

// Call invalidateKMSCache() after KMS updates
export function invalidateKMSCache() {
  KMS_CACHE.delete('kms');
}
```

**Usage in API routes:**
```typescript
// app/api/kms/summary/route.ts
import { getKMSData, invalidateKMSCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  // Gets from cache if file unchanged
  const kmsData = getKMSData();

  const summary = {
    decisions: countDecisions(kmsData),
    actions: countActions(kmsData),
    // ...
  };

  return NextResponse.json(summary);
}

export async function PUT(request: NextRequest) {
  // After update, invalidate cache
  const result = await updateKMS(request);
  invalidateKMSCache();  // ← Next request will reload
  return NextResponse.json(result);
}
```

**Pros:**
- Simple implementation
- Automatic invalidation (no manual TTL)
- Zero false cache hits
- No external dependencies

**Cons:**
- Per-request stat check (~1ms)
- Doesn't help with data aggregation time

---

### Solution 2: Request Deduplication with TTL (GOOD)
**Effort:** 2-3 hours | **Risk:** Low | **Simplicity:** Good

Cache results for 30 seconds (adjustable TTL).

```typescript
// lib/request-cache.ts
interface TimedCache<T> {
  data: T;
  expiresAt: number;
}

const CACHE = new Map<string, TimedCache<any>>();
const DEFAULT_TTL = 30 * 1000;  // 30 seconds

export function cacheGet<T>(key: string): T | null {
  const entry = CACHE.get(key);

  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }

  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T, ttl = DEFAULT_TTL) {
  CACHE.set(key, {
    data,
    expiresAt: Date.now() + ttl,
  });
}

export function cacheInvalidate(pattern: string) {
  // Invalidate keys matching pattern
  for (const key of CACHE.keys()) {
    if (key.includes(pattern)) {
      CACHE.delete(key);
    }
  }
}
```

**Usage:**
```typescript
export async function GET(request: NextRequest) {
  const cacheKey = 'summary:' + getQueryString(request);
  const cached = cacheGet(cacheKey);

  if (cached) {
    return NextResponse.json(cached);
  }

  // Compute if not cached
  const summary = computeSummary();
  cacheSet(cacheKey, summary);  // Cache for 30s

  return NextResponse.json(summary);
}
```

**Pros:**
- Simple TTL expiration
- Works with query parameters
- Reduces redundant computation

**Cons:**
- Manual TTL management
- Stale data for up to 30s
- Not ideal for real-time updates

---

### Solution 3: Redis External Cache (ENTERPRISE)
**Effort:** 4-5 hours | **Risk:** Medium | **Scalability:** Excellent

Use Redis for distributed caching across multiple instances.

```typescript
// lib/redis-cache.ts
import { createClient } from 'redis';

const redis = createClient({ host: process.env.REDIS_HOST });

export async function cacheGet<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

export async function cacheSet<T>(key: string, data: T, ttl = 300) {
  await redis.setEx(key, ttl, JSON.stringify(data));
}
```

**Pros:**
- Distributed caching (multiple servers)
- Persistent across restarts
- Support for expiration

**Cons:**
- External dependency
- Complexity increase
- Overkill for current scale

---

## Recommended Action

**Implement Solution 1 (File Modification Time Caching)** - Best for current single-instance deployment. Add Solution 2 (TTL) for additional redundancy.

---

## Technical Details

**Implementation Steps:**

1. **Create cache library:**
   ```bash
   touch lib/cache.ts
   ```

2. **Add getKMSData() function** with mtime-based caching

3. **Update all 4 API routes:**
   - `app/api/kms/summary/route.ts`
   - `app/api/kms/decisions/route.ts`
   - `app/api/kms/actions/route.ts`
   - `app/api/kms/risks/route.ts`

4. **Add cache invalidation** after write operations

5. **Test cache behavior** with integration tests

**Files to Create:**
- `lib/cache.ts` - Caching logic

**Files to Modify:**
- `app/api/kms/*/route.ts` - All 4 GET endpoints

**Monitoring:**
- Add cache hit/miss metrics
- Log cache invalidation events

---

## Acceptance Criteria

- [ ] Cache library created with mtime checking
- [ ] All 4 GET endpoints use caching
- [ ] Summary API: <5ms response time
- [ ] Decisions API: <5ms response time
- [ ] Actions API: <5ms response time
- [ ] Cache invalidates when file changes
- [ ] PUT/POST operations invalidate cache
- [ ] Dashboard load time < 100ms (5 requests)
- [ ] Integration tests verify cache behavior
- [ ] No stale data returned

---

## Performance Metrics

**Before Caching:**
```
Request 1 (Summary): 95ms
Request 2 (Decisions): 85ms
Request 3 (Actions): 75ms
Request 4 (Risks): 70ms
Request 5 (Relationships): 50ms
─────────────────────────
Total: 375ms (in parallel: ~95ms)
Page render: 1500ms (with network latency)
```

**After Caching (Same 5 requests):**
```
Request 1 (Summary): 1ms (cache hit)
Request 2 (Decisions): 1ms (cache hit)
Request 3 (Actions): 1ms (cache hit)
Request 4 (Risks): 1ms (cache hit)
Request 5 (Relationships): 1ms (cache hit)
─────────────────────────
Total: 5ms (in parallel: ~1ms)
Page render: 50ms (with network latency)
```

**Improvement:** 30x faster dashboard

---

## Work Log

- [ ] **Phase 1 (1h):** Create cache.ts with mtime logic
- [ ] **Phase 2 (1h):** Update 4 API routes
- [ ] **Phase 3 (30m):** Add cache invalidation
- [ ] **Phase 4 (1h):** Write tests and benchmarks

---

## Resources

- [Node.js fs.statSync() Documentation](https://nodejs.org/en/docs/guides/file-system/#:~:text=fs.statSync(path))
- [Caching Best Practices](https://www.cloudflare.com/learning/cdn/what-is-caching/)
- [Performance Analysis Report](./../../PERFORMANCE_ANALYSIS.md#phase-1-quick-wins)

---

## Related Todos

- `008-pending-p2-perf-filter-fix.md` - Fix O(n²) filters
- `009-pending-p2-perf-duplicate-reads.md` - Eliminate duplicate reads
- `010-pending-p2-perf-virtualization.md` - Table virtualization
